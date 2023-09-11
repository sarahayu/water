import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Map} from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import DeckGL from '@deck.gl/react';
import { CompositeLayer, SolidPolygonLayer } from "deck.gl"
import {GeoJsonLayer, PolygonLayer, ScatterplotLayer} from '@deck.gl/layers';
import {H3HexagonLayer} from '@deck.gl/geo-layers';
import {LightingEffect, AmbientLight, _SunLight as SunLight} from '@deck.gl/core';
import {scaleLinear, scaleThreshold} from 'd3-scale';
import UniformDotFilter from './UniformDotFilter';
import vancouverData from './vancouver-blocks.json'
import * as d3Geo from 'd3-geo'
import * as h3 from 'h3-js'
import { lerp } from '@math.gl/core'

// Source data GeoJSON
// const DATA_URL =
//   'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/geojson/vancouver-blocks.json'; // eslint-disable-line

function scaleBounds (hexId, paths, value = 1) {

  // if(!outside) return

  // get center and distance to lerp from
  const dist = value
  const [centerLat, centerLng] = h3.cellToLatLng(hexId)

  // lerp each vertex
  let scaledPaths = paths.map(v => {
      let v1Lng = lerp(centerLng, v[0][0], dist)
      let v1Lat = lerp(centerLat, v[0][1], dist)
      let v2Lng = lerp(centerLng, v[1][0], dist)
      let v2Lat = lerp(centerLat, v[1][1], dist)

      return [[v1Lng, v1Lat], [v2Lng, v2Lat]]
  })

  return scaledPaths
}

function createBorderPolygons (borderingBounds, scaledBounds) {

  let polygons = []

  for (let idx = 0; idx < borderingBounds.length; idx++) {

      let polygon = []

      polygon.push(scaledBounds[idx][1])
      polygon.push(scaledBounds[idx][0])
      polygon.push(borderingBounds[idx][0])
      polygon.push(borderingBounds[idx][1])
      
      polygons.push(polygon)
  }

  return polygons
}

function calcPolyBorder (hexId) {

  // calc hexagonal tile outline boundary
  let bounds = h3.cellToBoundary(hexId).map(p => [p[1], p[0]])

  // only consider bouding edges
  let borderingBounds = []
  for (let index = 0; index < bounds.length; index++) {
      let edge = [bounds[index], bounds[(index + 1) % bounds.length]]
      borderingBounds.push(edge)
  }

  // scale bounds and create polygons
  let scaledBoundsOuter = scaleBounds(hexId, borderingBounds, 0.8)
  let scaledBoundsInner = scaleBounds(hexId, borderingBounds, 0.6)
  let borderPolygons = createBorderPolygons(scaledBoundsOuter, scaledBoundsInner)

  return borderPolygons
}

export const COLOR_SCALE = scaleLinear()
  .domain([-0.6, -0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2])
  .range([
    [65, 182, 196],
    [127, 205, 187],
    [199, 233, 180],
    [237, 248, 177],
    // zero
    [255, 255, 204],
    [255, 237, 160],
    [254, 217, 118],
    [254, 178, 76],
    [253, 141, 60],
    [252, 78, 42],
    [227, 26, 28],
    [189, 0, 38],
    [128, 0, 38]
  ]);

const INITIAL_VIEW_STATE = {
  latitude: 49.254,
  longitude: -123.13,
  zoom: 11,
  maxZoom: 16,
  pitch: 45,
  bearing: 0
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';

const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.0
});

const dirLight = new SunLight({
  timestamp: Date.UTC(2019, 7, 1, 22),
  color: [255, 255, 255],
  intensity: 1.0,
  _shadow: true
});

const landCover = [
  [
    [-123.0, 49.196],
    [-123.0, 49.324],
    [-123.306, 49.324],
    [-123.306, 49.196]
  ]
];

function getTooltip({object}) {
  return (
    object && {
      html: `\
  <div><b>Average Property Value</b></div>
  <div>${object.properties.valuePerParcel} / parcel</div>
  <div>${object.properties.valuePerSqm} / m<sup>2</sup></div>
  <div><b>Growth</b></div>
  <div>${Math.round(object.properties.growth * 100)}%</div>
  `
    }
  );
}

function avg(arr) {
  return arr.reduce((a, b) => a + b) / arr.length
}

function flatten(arr) {  
  return [].concat.apply([], arr)
}

/**
 * 
 * returns array of points
 * [[lat1, lon1], [lat2, lon2], ...]
 */
function polygonToPoints(dataFeature) {
  let points = []

  // How to flatten array: https://stackoverflow.com/a/10865042
  let flattenedCoords = flatten(dataFeature.geometry.coordinates)

  let lons = flattenedCoords.map(entry => entry[0])
  let lats = flattenedCoords.map(entry => entry[1])
  
  let bounds = {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  
  }

  let stepSize = 0.0005

  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += stepSize) {
    for (let lon = bounds.minLon; lon <= bounds.maxLon; lon += stepSize) {
      if (d3Geo.geoContains(dataFeature, [lon, lat])) {
        points.push([lon, lat])
      }
    }
  }


  return points
}

/**
 * 
 * returns array of points and properties
 * [[lat1, lon1, properties1], [lat2, lon2, properties2], ...]
 */
function geojsonToGridPoints(dataFeatures) {
  let points = []

  dataFeatures.forEach(feature => {
    let regionPoints = polygonToPoints(feature)
    points.push(...regionPoints.map(coord => [...coord, feature.properties]))
  })

  return points
}

/**
 * 
 * returns array of hexids and avgProperty
 * [[hexId1, avgProperty1], [hexId2, avgProperty2], ...]
 */
function gridPointsToHexPoints(gridPoints, prop) {
  let binnedPoints = {}

  gridPoints.forEach(point => {
    let hexId = h3.latLngToCell(point[1], point[0], 8)

    if (hexId in binnedPoints) {
      binnedPoints[hexId].push(point[2][prop])
    }
    else {
      binnedPoints[hexId] = [ point[2][prop] ]
    }
  })

  let points = []

  let i = 0

  for (let hexId in binnedPoints) {
    points.push([hexId, avg(binnedPoints[hexId])])
  }

  return points
}

/**
 * 
 * returns array of hexId and growth
 * [[hexId1, growth1], [hexId2, growth2], ...]
 */
function geojsonToHexPoints(dataFeatures) {
  let gridPoints = geojsonToGridPoints(dataFeatures)
  let hexPoints = gridPointsToHexPoints(gridPoints, "growth")
  return hexPoints
}

const defaultProps = {
  getPolygon: d => d
}

class HexTileBorderLayer extends CompositeLayer {

  renderLayers() {

    let layers = []
    let hextiles = geojsonToHexPoints(this.props.data.features)

    let count = 0

    let polygons = []

    hextiles.forEach(tile => {

      let tilePolygon = calcPolyBorder(tile[0])

      tilePolygon = flatten(tilePolygon)

      polygons.push([tilePolygon, tile[1]])
    })

    layers.push(new SolidPolygonLayer({
      id: `asdfasdf`,
      data: polygons,
      getPolygon: d => d[0],
      getFillColor: d => COLOR_SCALE(d[1]),
    }))
    return layers
  }
}

HexTileBorderLayer.layerName = 'HexTileBorderLayer'
HexTileBorderLayer.defaultProps = defaultProps

export default function App({data = vancouverData, mapStyle = MAP_STYLE}) {
  const [effects] = useState(() => {
    const lightingEffect = new LightingEffect({ambientLight, dirLight});
    lightingEffect.shadowColor = [0, 0, 0, 0.5];
    return [lightingEffect];
  });
  
  const layers = [
    new HexTileBorderLayer({
        id: `ActivityBorderLayer`,
        data,
        // getFillColor: d => [216, 87, 0, 255],
        // pickable: true,
    }),
    // new ScatterplotLayer({
    //   id: 'scatter-plot',
    //   data: geojsonToGridPoints(data.features),
    //   radiusScale: 15,
    //   radiusMinPixels: 0.25,
    //   getPosition: d => [d[0], d[1], 0],
    //   getFillColor: d => COLOR_SCALE(d[2].growth),
    //   getRadius: 1,
    //   // updateTriggers: {
    //   //   getFillColor: [maleColor, femaleColor]
    //   // }
    // })
    // new H3HexagonLayer({
    //   id: 'h3-hexagon-layer',
    //   data: geojsonToHexPoints(data.features),
    //   // pickable: true,
    //   wireframe: false,
    //   filled: true,
    //   extruded: false,
    //   getHexagon: d => d[0],
    //   getFillColor: d => COLOR_SCALE(d[1]),
    // }),
  ];

  return (
    <DeckGL
      layers={layers}
      effects={effects}
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      getTooltip={getTooltip}
    >
      <Map reuseMaps mapLib={maplibregl} mapStyle={mapStyle} preventStyleDiffing={true} />
    </DeckGL>
  );
}

export function renderToDOM(container) {
  createRoot(container).render(<App />);
}

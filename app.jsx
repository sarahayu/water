import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Map} from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import DeckGL from '@deck.gl/react';
import {OBJLoader} from '@loaders.gl/obj';
import { CompositeLayer, SolidPolygonLayer } from "deck.gl"
import {GeoJsonLayer, PolygonLayer, ScatterplotLayer} from '@deck.gl/layers';
import {H3HexagonLayer} from '@deck.gl/geo-layers';
import {LightingEffect, AmbientLight, _SunLight as SunLight, MapView} from '@deck.gl/core';
import UniformDotFilter from './UniformDotFilter';
// import vancouverData from './vancouver-blocks.json'
import groundwaterData from './Baseline_Groundwater.json'
import unmetdemandData from './Baseline_Unmetdemand_Process.json'
import SolidHexTileLayer, { geojsonToGridPoints } from './SolidHexTileLayer'
import {scaleLinear, scaleThreshold} from 'd3-scale';
import {interpolateReds, interpolateBlues, interpolateGreens} from 'd3';
import * as h3 from 'h3-js'
import { Noise } from 'noisejs'
import IconHexTileLayer from './IconHexTileLayer';

// Source data GeoJSON
// const DATA_URL =
//   'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/geojson/vancouver-blocks.json'; // eslint-disable-line

const INITIAL_VIEW_STATE = {
  longitude: -122,
  latitude: 39,
  zoom: 9,
  pitch: 60,
  bearing: 30
}

const colorInterp = (unmetDemand) => interpolateReds(
  scaleLinear().domain([-250, 10]).range([1, 0])(unmetDemand)
).replace(/[^\d,]/g, '').split(',').map(d => Number(d))

const valueInterp = scaleLinear()
  .domain([-250, 10])
  .range([1, 0])
  .clamp(true)

const colorInterpGW = (groundwater) => interpolateBlues(
  scaleLinear().domain([-250, 700]).range([0, 1])(groundwater)
).replace(/[^\d,]/g, '').split(',').map(d => Number(d))

const resScale = scaleLinear()
  .domain([INITIAL_VIEW_STATE.zoom, INITIAL_VIEW_STATE.zoom + 2])
  .range([0, 1])
  .clamp(true)

const COLOR_SCALE = scaleLinear()
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

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';

const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.0
});

const dirLight = new SunLight({
  timestamp: Date.UTC(2019, 7, 1, 22),
  color: [255, 255, 255],
  intensity: 1.0,
  // _shadow: true
});

const landCover = [
  [
    [-123.0, 49.196],
    [-123.0, 49.324],
    [-123.306, 49.324],
    [-123.306, 49.196]
  ]
];
{/* <div>${object.properties.valuePerParcel} / parcel</div> */}
function getTooltip({object}) {
  return (
    object && {
      html: `\
      <div><b>Average Property Value</b></div>
      <div>${object.properties.valuePerSqm} / m<sup>2</sup></div>
      <div><b>Growth</b></div>
      <div>${Math.round(object.properties.growth * 100)}%</div>
  `
    }
  );
}

export default function App({data = groundwaterData, mapStyle = MAP_STYLE}) {
  const [effects] = useState(() => {
    const lightingEffect = new LightingEffect({ambientLight, dirLight});
    lightingEffect.shadowColor = [0, 0, 0, 0.5];
    return [lightingEffect];
  });
  const [curZoom, setCurZoom] = useState(1);

  const avgArrOfArr = arr => {
      let avgArr = []

      for (let j = 0; j < arr[0].length; j++) {
          avgArr.push(arr.map(a => Number(a[j])).reduce((a, b) => (a + b)) / arr.length)
      }

      return avgArr
  }

  let noise = new Noise(0.314);
  
  // let curRes = Math.max(Math.min((curZoom - INITIAL_VIEW_STATE.zoom) / (INITIAL_VIEW_STATE.maxZoom - INITIAL_VIEW_STATE.zoom), 1), 0)
  let curRes = resScale(curZoom)
  const layers = [
    // new SolidHexTileLayer({
    //     id: `ActivityInnerBorderLayer`,
    //     data,
    //     thicknessRange: [0, 0.7],
    //     // averageFn: arr => ( { growth: arr.map(a => a.growth).reduce((a, b) => a + b) / arr.length } ),
    //     filled: true,
    //     getFillColor: d => colorInterpGW(d.properties.growth),
    //     pickable: true,
    //     noise: new Noise(0.314),
    // }),
    new SolidHexTileLayer({
      id: `ActivityBaseBorderLayer`,
      data: groundwaterData,
      thicknessRange: [0, 1],
      averageFn: (arr, hexID) => { 
        const [centerLat, centerLng] = h3.cellToLatLng(hexID)
        let value = noise.simplex2(centerLat, centerLng) / 2 + 0.5;
      
        return {
          Elevation: value,
          Groundwater: avgArrOfArr(arr.map(a => Object.values(a.Groundwater))),
        }
      },
      filled: true,
      extruded: true,
      getElevation: d => d.properties.Elevation * 10000,
      resolution: curRes,
      getFillColor: d => colorInterpGW(d.properties.Groundwater[1197]),
      pickable: true,
      opacity: 0.9,
    }),
    // new SolidHexTileLayer({
    //   id: `ActivityBaseBorderLayer2`,
    //   data: unmetdemandData,
    //   thicknessRange: [0, 0.65],
    //   averageFn: (arr, hexID) => { 
    //     const [centerLat, centerLng] = h3.cellToLatLng(hexID)
    //     let value = noise.simplex2(centerLat, centerLng) / 2 + 0.5;
      
    //     return {
    //       Elevation: value,
    //       UnmetDemand: avgArrOfArr(arr.map(a => Object.values(a.UnmetDemand))),
    //     }
    //   },
    //   filled: true,
    //   raised: true,
    //   getElevation: d => d.properties.Elevation * 10000 + 1,
    //   resolution: curRes,
    //   getFillColor: d => colorInterp(d.properties.UnmetDemand[1197]),
    //   pickable: true,
    //   opacity: 0.9,
    // }),
    new IconHexTileLayer({
      id: `ActivityAmtBorderLayer`,
      data: unmetdemandData,
      averageFn: (arr, hexID) => { 
        const [centerLat, centerLng] = h3.cellToLatLng(hexID)
        let value = noise.simplex2(centerLat, centerLng) / 2 + 0.5;

        return {
          Elevation: value,
          UnmetDemand: avgArrOfArr(arr.map(a => Object.values(a.UnmetDemand))),
        }
      },
      loaders: [OBJLoader],
      mesh: './eyeball.obj',
      raised: true,
      getElevation: d => d.properties.Elevation * 10000 + 1,
      resolution: curRes,
      getColor: [0, 100, 0],
      getValue: d => valueInterp(d.properties.UnmetDemand[1197]),
      sizeScale: 480,
      pickable: true,
      opacity: 0.9,
    }),

//     new GeoJsonLayer({
//       id: 'geojson',
//       data: groundwaterData,
//       opacity: 0.9,
//       stroked: false,
//       filled: true,
//       // extruded: true,
//       wireframe: true,
//       // getElevation: f => Math.sqrt(f.properties.valuePerSqm) * 10,
//       getFillColor: f => colorInterpGW(f.properties.Groundwater[1197]),
//       getLineColor: [255, 255, 255],
//       pickable: true
//     }),
// new GeoJsonLayer({
//   id: 'geojson2',
//   data: unmetdemandData,
//   opacity: 0.3,
//   stroked: false,
//   filled: true,
//   // extruded: true,
//   wireframe: true,
//   // getElevation: f => Math.sqrt(f.properties.valuePerSqm) * 10,
//   getFillColor: f => colorInterp(f.properties.UnmetDemand[1197]),
//   getLineColor: [255, 255, 255],
//   pickable: true
// })
  // new SolidHexTileLayer({
  //     id: `ActivityOuterBorderLayer`,
  //     data,
  //     thicknessRange: [0.7, 1],
  //     // averageFn: arr => ( { growth: arr.map(a => a.growth).reduce((a, b) => a + b) / arr.length } ),
  //     filled: true,
  //     raised: false,
  //     resolution: curRes,
  //     // extruded: true,
  //     // wireframe: true,
  //     // getElevation: d => d.properties.growth * 3000 + 1,
  //     getFillColor: d => colorInterp(d.properties.growth),
  //     // getFillColor: d => COLOR_SCALE(0),
  //     pickable: true,
  //     opacity: 1,
  //     noise: new Noise(0.514),
  //     heightNoise: new Noise(0.314),
  // }),
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
      onViewStateChange={({viewState}) => {
        setCurZoom(viewState.zoom)}}
      // views={ new MapView({ orthographic: true }) }
      getTooltip={getTooltip}
    >
      <Map reuseMaps mapLib={maplibregl} mapStyle={mapStyle} preventStyleDiffing={true} />
    </DeckGL>
  );
}

export function renderToDOM(container) {
  createRoot(container).render(<App />);
}

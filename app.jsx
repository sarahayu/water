import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Map} from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import DeckGL from '@deck.gl/react';
import { CompositeLayer, SolidPolygonLayer } from "deck.gl"
import {GeoJsonLayer, PolygonLayer, ScatterplotLayer} from '@deck.gl/layers';
import {H3HexagonLayer} from '@deck.gl/geo-layers';
import {LightingEffect, AmbientLight, _SunLight as SunLight, MapView} from '@deck.gl/core';
import UniformDotFilter from './UniformDotFilter';
import vancouverData from './vancouver-blocks.json'
import HexTileBorderLayer, { geojsonToGridPoints } from './HexTileBorderLayer';
import {scaleLinear, scaleThreshold} from 'd3-scale';
import {interpolateReds, interpolateBlues, interpolateGreens} from 'd3';
import { Noise } from 'noisejs'

// Source data GeoJSON
// const DATA_URL =
//   'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/geojson/vancouver-blocks.json'; // eslint-disable-line

const INITIAL_VIEW_STATE = {
  latitude: 49.254,
  longitude: -123.13,
  zoom: 11,
  maxZoom: 16,
  pitch: 45,
  bearing: 0
};

const colorInterp = (unmetDemand) => interpolateReds(
  scaleLinear().domain([-0.6, 1]).range([1, 0])(unmetDemand)
).replace(/[^\d,]/g, '').split(',').map(d => Number(d))

const colorInterpGW = (groundwater) => interpolateBlues(
  scaleLinear().domain([-0.6, 1]).range([1, 0])(groundwater)
).replace(/[^\d,]/g, '').split(',').map(d => Number(d))

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

export default function App({data = vancouverData, mapStyle = MAP_STYLE}) {
  const [effects] = useState(() => {
    const lightingEffect = new LightingEffect({ambientLight, dirLight});
    lightingEffect.shadowColor = [0, 0, 0, 0.5];
    return [lightingEffect];
  });
  
  const layers = [
    // new HexTileBorderLayer({
    //     id: `ActivityInnerBorderLayer`,
    //     data,
    //     thicknessRange: [0, 0.7],
    //     // averageFn: arr => ( { growth: arr.map(a => a.growth).reduce((a, b) => a + b) / arr.length } ),
    //     filled: true,
    //     getFillColor: d => colorInterpGW(d.properties.growth),
    //     pickable: true,
    //     noise: new Noise(0.314),
    // }),
    new HexTileBorderLayer({
      id: `ActivityInnerBorderLayer`,
      data,
      thicknessRange: [0, 0.8],
      // averageFn: arr => ( { growth: arr.map(a => a.growth).reduce((a, b) => a + b) / arr.length } ),
      filled: true,
      raised: false,
      // extruded: true,
      // wireframe: true,
      // getElevation: d => d.properties.growth * 3000 + 1,
      getFillColor: d => colorInterpGW(d.properties.valuePerSqm),
      // getFillColor: d => COLOR_SCALE(0),
      pickable: true,
      opacity: 0.1,
      noise: new Noise(0.514),
      heightNoise: new Noise(0.314),
  }),
  new HexTileBorderLayer({
      id: `ActivityOuterBorderLayer`,
      data,
      thicknessRange: [0.8, 1],
      // averageFn: arr => ( { growth: arr.map(a => a.growth).reduce((a, b) => a + b) / arr.length } ),
      filled: true,
      raised: false,
      // extruded: true,
      // wireframe: true,
      // getElevation: d => d.properties.growth * 3000 + 1,
      getFillColor: d => colorInterp(d.properties.growth),
      // getFillColor: d => COLOR_SCALE(0),
      pickable: true,
      opacity: 0.1,
      noise: new Noise(0.514),
      heightNoise: new Noise(0.314),
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
      views={ new MapView({ orthographic: true }) }
      getTooltip={getTooltip}
    >
      <Map reuseMaps mapLib={maplibregl} mapStyle={mapStyle} preventStyleDiffing={true} />
    </DeckGL>
  );
}

export function renderToDOM(container) {
  createRoot(container).render(<App />);
}

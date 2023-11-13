import { AmbientLight, LightingEffect, _SunLight as SunLight } from '@deck.gl/core';
import { OBJLoader } from '@loaders.gl/obj';
import { GeoJsonLayer } from '@deck.gl/layers';
import DeckGL from '@deck.gl/react';
import maplibregl from 'maplibre-gl';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import SolidHexTileLayer from './SolidHexTileLayer'
import IconHexTileLayer from './IconHexTileLayer'
import groundwaterData from './groundwater_hex_small.json'
import differencedemandData from './difference_hex_small.json'
import unmetdemandData from './bl_h000_hex_small.json'
import { Map } from 'react-map-gl';
import { interpolateBlues, interpolatePRGn, interpolateReds } from 'd3';
import { scaleLinear } from 'd3-scale';
import { Noise } from 'noisejs';

// Source data GeoJSON
// const DATA_URL =
//   'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/geojson/vancouver-blocks.json'; // eslint-disable-line

const INITIAL_VIEW_STATE = {
  longitude: -120.52,
  latitude: 37.14,
  zoom: 7.87,
  pitch: 50.85,
  bearing: 32.58
}
// const INITIAL_VIEW_STATE = {
//   longitude: -120.61,
//   latitude: 37.63,
//   zoom: 6.94,
//   pitch: 15.95,
//   bearing: 40.9
// }

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

const colorInterpDifference = (unmetDemand) => interpolatePRGn(
  scaleLinear().domain([-50, 50]).range([0, 1])(unmetDemand)
).replace(/[^\d,]/g, '').split(',').map(d => Number(d))

const valueInterpDifference = scaleLinear()
.domain([-50, 50])
.range([0, 1])
.clamp(true)

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

export default function App({data, mapStyle = MAP_STYLE}) {
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
    new SolidHexTileLayer({
      id: `GroundwaterLayerHex`,
      data: groundwaterData,
      thicknessRange: [0, 1],
      filled: true,
      extruded: true,
      getElevation: d => d.properties.Elevation * 20,
      resolution: curRes,
      getFillColor: d => colorInterpGW(d.properties.Groundwater[1026]),
      opacity: 0.9,
    }),
    new SolidHexTileLayer({
      id: `DifferenceLayerHex`,
      data: differencedemandData,
      thicknessRange: [0.5, 0.65],
      filled: true,
      raised: true,
      getElevation: d => d.properties.Elevation * 20 + 1,
      resolution: curRes,
      getFillColor: d => colorInterpDifference(d.properties.Difference[1026]),
      opacity: 0.9,
    }),
    new IconHexTileLayer({
      id: `UnmetDemandIcons`,
      data: unmetdemandData,
      loaders: [OBJLoader],
      mesh: './eyeball.obj',
      raised: true,
      getElevation: d => d.properties.Elevation * 20 + 1,
      resolution: curRes,
      getColor: [200, 0, 0],
      getValue: d => valueInterp(d.properties.UnmetDemand[1026]),
      sizeScale: 480,
      opacity: 0.9,
    }),
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

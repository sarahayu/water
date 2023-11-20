import { AmbientLight, LightingEffect, _SunLight as SunLight } from '@deck.gl/core';
import { OBJLoader } from '@loaders.gl/obj';
import { GeoJsonLayer } from '@deck.gl/layers';
import DeckGL from '@deck.gl/react';
import maplibregl from 'maplibre-gl';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SolidHexTileLayer from './SolidHexTileLayer'
import IconHexTileLayer from './IconHexTileLayer'
import allData from './process/combine_hex_small_norm.json'
// import diffUnmetData from './process/diff_unmet_geo_unnorm.json'
import { Map } from 'react-map-gl';
import { interpolateBlues, interpolatePRGn, interpolateReds } from 'd3';
import * as d3 from 'd3';
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

const colorInterpDifference = (unmetDemand) => d3.interpolate(interpolatePRGn(
  scaleLinear().domain([-50, 50]).range([0, 1])(unmetDemand)
), 'white')(0).replace(/[^\d,]/g, '').split(',').map(d => Number(d))

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

const _elevScale = d3.scaleLinear(d3.extent(Object.values(allData[allData.length - 1]).map(e => e.Elevation)), [0, 50000])

const elevScale = elev => Math.min(_elevScale(elev), 20000)

export default function App({mapStyle = MAP_STYLE}) {
  const [effects] = useState(() => {
    const lightingEffect = new LightingEffect({ambientLight, dirLight});
    lightingEffect.shadowColor = [0, 0, 0, 0.5];
    return [lightingEffect];
  });
  const [curZoom, setCurZoom] = useState(1);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    setTimeout(() => setCounter(c => c + 1), 500)
  }, [counter])
  
  let curRes = resScale(curZoom)
  const layers = [
    // new SolidHexTileLayer({
    //   id: `DifferenceLayerHex`,
    //   data: difnorm,
    //   thicknessRange: [0, 1],
    //   filled: true,
    //   resolution: curRes,
    //   getFillColor: d => colorInterpDifference(d.properties.Difference[counter % 1200]),
    //   updateTriggers: {
    //     getFillColor: [counter]
    //   }
    //   // opacity: 0.9,
    // }),


    new SolidHexTileLayer({
      id: `DifferenceLayerHex`,
      data: allData.map(reses => {
        let newReses = {}
        for (let hexId in reses) {
          if (reses[hexId].Difference) 
            newReses[hexId] = reses[hexId]
        }
        return newReses
      }),
      thicknessRange: [0, 1],
      filled: true,
      extruded: true,
      getElevation: (d, i) => elevScale(d.properties.Elevation),
      resolution: curRes,
      getFillColor: d => d.properties.Difference ? colorInterpDifference(d.properties.Difference[counter % 1200]) : [0, 0, 0, 0],
      opacity: 0.9,
      updateTriggers: {
        getFillColor: [counter],
      },
    }),
    new SolidHexTileLayer({
      id: `GroundwaterLayerHex`,
      data: allData,
      thicknessRange: [0.65, 0.80],
      filled: true,
      raised: true,
      getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1 : 10,
      resolution: curRes,
      getFillColor: d => colorInterpGW(d.properties.Groundwater[counter % 1200]),
      // opacity: 0.9,
      updateTriggers: {
        getFillColor: [counter],
      },
    }),
    new IconHexTileLayer({
      id: `UnmetDemandIcons`,
      data: allData.map(reses => {
        let newReses = {}
        for (let hexId in reses) {
          if (reses[hexId].Difference) 
            newReses[hexId] = reses[hexId]
        }
        return newReses
      }),
      loaders: [OBJLoader],
      mesh: './drop.obj',
      raised: true,
      getElevation: d => elevScale(d.properties.Elevation) + 1000,
      resolution: curRes,
      getColor: d => [232, 72, 72],
      getValue: d => valueInterp(d.properties.UnmetDemand[counter % 1200]),
      sizeScale: 3000,
      // opacity: 0.9,
      updateTriggers: {
        getValue: [counter],
      },
    }),
  ];

  return (
    <>
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
      <span style={{ position: 'absolute', display: 'block', top: 0, right: 0 }}>Month { counter }</span>
    </>
  );
}

export function renderToDOM(container) {
  createRoot(container).render(<App />);
}

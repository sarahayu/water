import { AmbientLight, LightingEffect, _SunLight as SunLight } from '@deck.gl/core';
import { OBJLoader } from '@loaders.gl/obj';
import { GeoJsonLayer } from '@deck.gl/layers';
import DeckGL from '@deck.gl/react';
import maplibregl from 'maplibre-gl';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SolidHexTileLayer from './SolidHexTileLayer'
import IconHexTileLayer from './IconHexTileLayer'
import allData from './process/combine_hex_med_res_norm.json'
// import groundwaterData from './Baseline_Groundwater.json'
import { Map } from 'react-map-gl';
import { interpolateBlues, interpolatePRGn, interpolateReds } from 'd3';
import * as d3 from 'd3';
import { scaleLinear } from 'd3-scale';
import newStyle from './style.json'
import { Noise } from 'noisejs';

// newStyle.layers.forEach(layer => {
//   let idd = layer.id
//   let isLabel = /label|place|poi/.test(idd)
//   if (isLabel) {
//     layer.paint["z-index"] = "1000"
//   }

// })

// Source data GeoJSON
// const DATA_URL =
//   'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/geojson/vancouver-blocks.json'; // eslint-disable-line

const VIEW_STATE1 = {
  longitude: -120.52,
  latitude: 37.14,
  zoom: 7.87,
  pitch: 50.85,
  bearing: 32.58
}
const VIEW_STATE2 = {
  longitude: -120.61,
  latitude: 37.63,
  zoom: 6.94,
  pitch: 15.95,
  bearing: 40.9
}
const VIEW_STATE3 = {
  longitude: -120.9079489385486,
  latitude: 37.53771682589752,
  zoom: 7.634107286385942,
  pitch: 50.85,
  bearing: 32.58,
}

const INITIAL_VIEW_STATE = VIEW_STATE1

const RGBtoHSV = function (color) {
  let r, g, b, h, s, v;
  r = color[0];
  g = color[1];
  b = color[2];
  let minn = Math.min(r, g, b);
  let maxx = Math.max(r, g, b);


  v = maxx;
  let delta = maxx - minn;
  if (maxx != 0)
    s = delta / maxx;        // s
  else {
    // r = g = b = 0        // s = 0, v is undefined
    s = 0;
    h = -1;
    return [h, s, undefined];
  }
  if (r === maxx)
    h = (g - b) / delta;      // between yellow & magenta
  else if (g === maxx)
    h = 2 + (b - r) / delta;  // between cyan & yellow
  else
    h = 4 + (r - g) / delta;  // between magenta & cyan
  h *= 60;                // degrees
  if (h < 0)
    h += 360;
  if (isNaN(h))
    h = 0;
  return [h, s, v];
};

const HSVtoRGB = function (color) {
  let i;
  let h, s, v, r, g, b;
  h = color[0];
  s = color[1];
  v = color[2];
  if (s === 0) {
    // achromatic (grey)
    r = g = b = v;
    return [r, g, b];
  }
  h /= 60;            // sector 0 to 5
  i = Math.floor(h);
  let f = h - i;          // factorial part of h
  let p = v * (1 - s);
  let q = v * (1 - s * f);
  let t = v * (1 - s * (1 - f));
  switch (i) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    default:        // case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return [r, g, b];
}

const saturate = col => {
  let hsv = RGBtoHSV(col);
  hsv[1] *= 2;
  let rgb = HSVtoRGB(hsv);
  return rgb
}

const colorInterp = (unmetDemand) => saturate(interpolateReds(
  scaleLinear().domain([-250, 10]).range([1, 0])(unmetDemand)
).replace(/[^\d,]/g, '').split(',').map(d => Number(d)))

const valueInterp = scaleLinear()
  .domain([-150, 10])
  .range([1, 0])
  .clamp(true)

const colorInterpGW = (groundwater) => saturate(interpolateBlues(
  scaleLinear().domain([-250, 700]).range([0, 1])(groundwater)
).replace(/[^\d,]/g, '').split(',').map(d => Number(d)))

const colorInterpDifference = (unmetDemand) => d3.interpolate(interpolatePRGn(
  scaleLinear().domain([-50, 50]).range([0, 1])(unmetDemand)
), 'white')(0.5).replace(/[^\d,]/g, '').split(',').map(d => Number(d))

const valueInterpDifference = scaleLinear()
  .domain([-50, 50])
  .range([0, 1])
  .clamp(true)

const resScale = scaleLinear()
  .domain([INITIAL_VIEW_STATE.zoom - 1, INITIAL_VIEW_STATE.zoom + 2])
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
{/* <div>${object.properties.valuePerParcel} / parcel</div> */ }
function getTooltip({ object }) {
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

function idToCol(idStr) {
  // console.log(idStr)
  // if (!idStr)
  //   return [0, 0, 0]
  //   let lastPart = idStr.substring(idStr.length - 2)
  //   if (lastPart == "SA" || lastPart == "XA" || lastPart == "PA" || lastPart == "NA")
  //       return [255, 0, 0]
  //   if (lastPart == "SU" || lastPart == "PU" || lastPart == "NU") {
  //     return [0, 0, 255]
  //   }
  //   return [0, 255, 0]

  if (idStr == 0)
    return [255, 0, 0]
  if (idStr == 1)
    return [0, 0, 255]

  return [0, 255, 0]
}


export default function App({ mapStyle = newStyle }) {
  const [effects] = useState(() => {
    const lightingEffect = new LightingEffect({ ambientLight, dirLight });
    lightingEffect.shadowColor = [0, 0, 0, 0.5];
    return [lightingEffect];
  });
  const [curZoom, setCurZoom] = useState(1);
  const [counter, setCounter] = useState(1100);
  const [playing, setPlaying] = useState(true);
  const [toolsVis, setToolsVis] = useState(true);
  const [render, setRender] = useState("render1");
  const [view, setView] = useState("view1");
  const [viewState, setViewState] = useState(VIEW_STATE1);

  useEffect(() => {

    function keyListener(e) {
      if (e.key == "F1") setToolsVis(v => !v)
    }

    document.addEventListener("keydown", keyListener, false);
    return function () {
      document.removeEventListener("keydown", keyListener, false);
    }
  }, [])

  useEffect(() => {
    if (playing) {
      let timer = setTimeout(() => setCounter(c => (c + 1) % 1200), 100)
      return function () {
        clearTimeout(timer)
      }

    }
  }, [counter, playing])

  useEffect(() => {
    if (view == "view1") {
      setViewState(VIEW_STATE1)
    }
    else if (view == "view2") {
      setViewState(VIEW_STATE2)
    }
    else if (view == "view3") {
      setViewState(VIEW_STATE3)
    }
  }, [view])

  let curRes = resScale(curZoom)
  const layers = [
    ...(render !== "render1" ? [] : [
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
        getFillColor: d => colorInterpDifference(d.properties.Difference[counter]),
        resRange: [5, 6],
        opacity: 0.9,
        updateTriggers: {
          getFillColor: [counter],
        },
      }),
      new SolidHexTileLayer({
        id: `GroundwaterLayer`,
        data: allData,
        thicknessRange: [0.65, 0.80],
        filled: true,
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1 : 10,
        resolution: curRes,
        getFillColor: d => colorInterpGW(d.properties.Groundwater[counter]),
        resRange: [5, 6],
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
        getColor: d => [255, 158, 102],
        getValue: d => valueInterp(d.properties.UnmetDemand[counter]),
        sizeScale: 3000,
        resRange: [5, 6],
        // opacity: 0.9,
        updateTriggers: {
          getValue: [counter],
        },
      }),
    ]),
    ...(render !== "render2" ? [] : [

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
        getFillColor: d => colorInterpDifference(d.properties.Difference[counter]),
        resRange: [5, 6],
        opacity: 0.9,
        updateTriggers: {
          getFillColor: [counter],
        },
      }),
      new SolidHexTileLayer({
        id: `GroundwaterLayer`,
        data: allData,
        thicknessRange: [0.65, 0.80],
        filled: true,
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1 : 10,
        resolution: curRes,
        getFillColor: d => colorInterpGW(d.properties.Groundwater[counter]),
        resRange: [5, 6],
        // opacity: 0.9,
        updateTriggers: {
          getFillColor: [counter],
        },
      }),
      new IconHexTileLayer({
        id: `SettlementIconsLayer`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse[0] == 0)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './dam.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [200, 0, 0],
        sizeScale: 500,
        offset: [0, 0.37],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `ExhangeIconsLayer`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse[0] == 1)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './cow.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [100, 100, 100],
        sizeScale: 550,
        // offset: [0, 0.37],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `ProjectIconsLayer`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse[0] == 2)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './project.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [0, 181, 0],
        sizeScale: 180,
        // offset: [0, 0.37],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `NonProjectIconsLayer`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse[0] == 3)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './nonproject.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [0, 0, 255],
        sizeScale: 140,
        // offset: [0, 0.37],
        resRange: [5, 6],
        // opacity: 0.9,
      }),

    ]),
    ...(render !== "render3" ? [] : [

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
        getFillColor: d => colorInterpDifference(d.properties.Difference[counter]),
        resRange: [5, 6],
        opacity: 0.9,
        updateTriggers: {
          getFillColor: [counter],
        },
      }),
      new SolidHexTileLayer({
        id: `UnmetDemandLayer`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].Difference)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        thicknessRange: [0.65, 0.80],
        filled: true,
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1 : 10,
        resolution: curRes,
        getFillColor: d => colorInterp(d.properties.UnmetDemand[counter]),
        resRange: [5, 6],
        // opacity: 0.9,
        updateTriggers: {
          getFillColor: [counter],
        },
      }),
      new IconHexTileLayer({
        id: `SettlementIconsLayer`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse[0] == 0)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './dam.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [200, 0, 0],
        sizeScale: 500,
        offset: [0, 0.37],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `ExhangeIconsLayer`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse[0] == 1)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './cow.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [100, 100, 100],
        sizeScale: 550,
        // offset: [0, 0.37],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `ProjectIconsLayer`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse[0] == 2)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './project.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [0, 181, 0],
        sizeScale: 180,
        // offset: [0, 0.37],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `NonProjectIconsLayer`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse[0] == 3)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './nonproject.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [0, 0, 255],
        sizeScale: 140,
        // offset: [0, 0.37],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
    ]),
    ...(render !== "render4" ? [] : [

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
        getFillColor: d => colorInterpDifference(d.properties.Difference[counter]),
        resRange: [5, 6],
        opacity: 0.9,
        updateTriggers: {
          getFillColor: [counter],
        },
      }),
      new SolidHexTileLayer({
        id: `UnmetDemandLayer`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].Difference)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        thicknessRange: [0.65, 0.80],
        filled: true,
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1 : 10,
        resolution: curRes,
        getFillColor: d => colorInterp(d.properties.UnmetDemand[counter]),
        resRange: [5, 6],
        // opacity: 0.9,
        updateTriggers: {
          getFillColor: [counter],
        },
      }),
      new IconHexTileLayer({
        id: `SettlementIconsLayer`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse[0] == 0)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './dam.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [200, 0, 0],
        sizeScale: 500,
        offset: [0, 0.37],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `ExhangeIconsLayer`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse[0] == 1)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './cow.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [100, 100, 100],
        sizeScale: 550,
        offset: [0, 0.37],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `ProjectIconsLayer`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse[0] == 2)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './project.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [0, 181, 0],
        sizeScale: 180,
        offset: [0, 0.37],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `NonProjectIconsLayer`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse[0] == 3)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './nonproject.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [0, 0, 255],
        sizeScale: 140,
        offset: [0, 0.37],
        resRange: [5, 6],
        // opacity: 0.9,
      }),

      new IconHexTileLayer({
        id: `SettlementIconsLayer2`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse.length > 1 && reses[hexId].LandUse[1] == 0)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './dam.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [200, 0, 0],
        sizeScale: 0.5 * 500,
        offset: [-0.5, -0.5],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `ExhangeIconsLayer2`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse.length > 1 && reses[hexId].LandUse[1] == 1)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './cow.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [100, 100, 100],
        sizeScale: 0.5 * 550,
        offset: [-0.5, -0.5],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `ProjectIconsLayer2`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse.length > 1 && reses[hexId].LandUse[1] == 2)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './project.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [0, 181, 0],
        sizeScale: 0.5 * 180,
        offset: [-0.5, -0.5],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `NonProjectIconsLayer2`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse.length > 1 && reses[hexId].LandUse[1] == 3)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './nonproject.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [0, 0, 255],
        sizeScale: 0.5 * 140,
        offset: [-0.5, -0.5],
        resRange: [5, 6],
        // opacity: 0.9,
      }),

      new IconHexTileLayer({
        id: `SettlementIconsLayer3`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse.length > 2 && reses[hexId].LandUse[2] == 0)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './dam.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [200, 0, 0],
        sizeScale: 0.5 * 500,
        offset: [0.5, -0.5],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `ExhangeIconsLayer3`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse.length > 2 && reses[hexId].LandUse[2] == 1)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './cow.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [100, 100, 100],
        sizeScale: 0.5 * 550,
        offset: [0.5, -0.5],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `ProjectIconsLayer3`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse.length > 2 && reses[hexId].LandUse[2] == 2)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './project.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [0, 181, 0],
        sizeScale: 0.5 * 180,
        offset: [0.5, -0.5],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
      new IconHexTileLayer({
        id: `NonProjectIconsLayer3`,
        data: allData.map(reses => {
          let newReses = {}
          for (let hexId in reses) {
            if (reses[hexId].LandUse && reses[hexId].LandUse.length > 2 && reses[hexId].LandUse[2] == 3)
              newReses[hexId] = reses[hexId]
          }
          return newReses
        }),
        loaders: [OBJLoader],
        mesh: './nonproject.obj',
        raised: true,
        getElevation: d => d.properties.Difference ? elevScale(d.properties.Elevation) + 1000 : 1000,
        resolution: curRes,
        getColor: d => [0, 0, 255],
        sizeScale: 0.5 * 140,
        offset: [0.5, -0.5],
        resRange: [5, 6],
        // opacity: 0.9,
      }),
    ]),
    // new GeoJsonLayer({
    //   id: 'geojson2',
    //   data: landuse,
    //   // opacity: 0.3,
    //   stroked: false,
    //   filled: true,
    //   // extruded: true,
    //   wireframe: true,
    //   // getElevation: f => Math.sqrt(f.properties.valuePerSqm) * 10,
    //   getFillColor: f => f.properties.LandUse === 0 ? [255, 0, 0] : (f.properties.LandUse === 1 ? [100, 100, 100] : (f.properties.LandUse === 2 ? [0, 181, 0] : [0, 0, 255])),
    //   getLineColor: [255, 255, 255],
    //   pickable: true
    // }),

  ];

  return (
    <>
      <DeckGL
        layers={layers}
        effects={effects}
        initialViewState={viewState}
        controller={true}
        onViewStateChange={({ viewState }) => {
          // console.log(viewState)
          setCurZoom(viewState.zoom)
        }}
        // views={ new MapView({ orthographic: true }) }
        getTooltip={getTooltip}
      >
        <Map reuseMaps mapLib={maplibregl} mapStyle={mapStyle} preventStyleDiffing={true} />
      </DeckGL>
      {
        toolsVis && <>

          <div onChange={function (e) {
            setRender(e.target.value)
          }} style={{
            position: 'absolute', display: 'block', bottom: "80%", right: "0", transform: "translateY(50%)"
          }}>

            <div>
              <input type="radio" name="render" value="render1" checked={render == "render1"} />
              <label htmlFor="render1">Render 1</label>
            </div>

            <div>
              <input type="radio" name="render" value="render2" checked={render == "render2"} />
              <label htmlFor="render2">Render 2</label>
            </div>

            <div>
              <input type="radio" name="render" value="render3" checked={render == "render3"} />
              <label htmlFor="render3">Render 3</label>
            </div>

            <div>
              <input type="radio" name="render" value="render4" checked={render == "render4"} />
              <label htmlFor="render4">Render 4</label>
            </div>
          </div>
          <div onChange={function (e) {
            setView(e.target.value)
          }} style={{
            position: 'absolute', display: 'block', bottom: "40%", right: "0", transform: "translateY(50%)"
          }}>

            <div>
              <input type="radio" name="view" value="view1" checked={view == "view1"} />
              <label htmlFor="view1">View 1</label>
            </div>

            <div>
              <input type="radio" name="view" value="view2" checked={view == "view2"} />
              <label htmlFor="view2">View 2</label>
            </div>

            <div>
              <input type="radio" name="view" value="view3" checked={view == "view3"} />
              <label htmlFor="view3">View 3</label>
            </div>
          </div>
          <div>
            <button onClick={() => {
              setPlaying(p => !p)
            }} style={{
              position: 'absolute', display: 'block', bottom: "20px", right: "40%", transform: "translateX(50%)"
            }}>{playing ? "Pause" : "Play"}</button>
            <div style={{ position: 'absolute', display: 'block', bottom: "20px", left: "40%", transform: "translateX(-50%)" }}>

              <span>[F1] to toggle controls | Month </span>
              <input type="number" name="tentacles" min="0" max="1199" value={counter} onChange={function (e) {
                setPlaying(false)
              }} onInput={function (e) {
                setCounter(parseInt(e.target.value))
              }} />
            </div>
            {/* <span style={{
              position: 'absolute', display: 'block', bottom: "20px", right: "50%", transform: "translateX(50%)"
            }}>({d3.scaleTime()
              .domain([new Date('10/31/1921'), new Date('9/30/2021')])
              .range([0, 1199])
              .invert(counter)
              .toLocaleString('default', { month: 'long' })})</span> */}
            <input onChange={function (e) {
              setPlaying(false)
              setCounter(parseInt(e.target.value))
            }} onInput={function (e) {
              setCounter(parseInt(e.target.value))
            }} value={counter} style={{
              width: '50vw',
              position: 'absolute', display: 'block', bottom: 0, right: "50%", transform: "translateX(50%)"
            }} type="range" min="0" max="1199" id="myRange" />
          </div>
        </>
      }
    </>
  );
}

export function renderToDOM(container) {
  createRoot(container).render(<App />);
}

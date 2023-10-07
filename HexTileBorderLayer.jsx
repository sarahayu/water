
import { CompositeLayer, SolidPolygonLayer } from "deck.gl"
import * as d3Geo from 'd3-geo'
import * as h3 from 'h3-js'
import { lerp } from '@math.gl/core'

function scaleBounds (hexId, paths, value = 1) {

  // if(!outside) return

  // get center and distance to lerp from
  const dist = value
  const [centerLat, centerLng] = h3.cellToLatLng(hexId)

  // lerp each vertex
  let scaledPaths = paths.map(v => {
      let v1Lng = lerp(centerLng, v[0], dist)
      let v1Lat = lerp(centerLat, v[1], dist)

      return [v1Lng, v1Lat]
  })

  return scaledPaths
}

function calcPolyBorder (hexId, [thicknessMin, thicknessMax]) {

  // calc hexagonal tile outline boundary
  let bounds = h3.cellToBoundary(hexId).map(p => [p[1], p[0]])

  // scale bounds and create polygons
  let scaledBoundsOuter = scaleBounds(hexId, bounds, thicknessMax)
  let scaledBoundsInner = scaleBounds(hexId, bounds, thicknessMin)
  // let borderPolygons = createBorderPolygons(scaledBoundsOuter, scaledBoundsInner)

  return [scaledBoundsOuter, scaledBoundsInner]
}

function avg(arr) {
  return arr.reduce((a, b) => a + b) / arr.length
}

function avgObject(arrObjs, centerLat, centerLng, noise, noise2) {  
  let avgObj = {}
  let value = noise.simplex2(centerLat * 10, centerLng *10);

  let propsToAvg = Object.keys(arrObjs[0] || {})

  avgObj[propsToAvg[0]] = noise.simplex2(centerLat * 10, centerLng *10);
  avgObj[propsToAvg[1]] = noise2.simplex2(centerLat * 10, centerLng *10);

  // propsToAvg.forEach(propToAvg => {
  //   // avgObj[propToAvg] = avg(arrObjs.map(hexPoint => hexPoint[propToAvg]))
  //   avgObj[propToAvg] = value / 2 + 0.5
  // })

  return avgObj
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
export function geojsonToGridPoints(dataFeatures) {
  let points = []

  dataFeatures.forEach(feature => {
    let regionPoints = polygonToPoints(feature)
    points.push(...regionPoints.map(coord => [...coord, feature.properties]))
  })

  return points
}

/**
 * 
 * returns array of array of hexids and avgProperty, ordered by resolution
 * [
 *  [[hexId1, avgProperties1], [hexId2, avgProperties2], ...],    // lowest resolution, larger hexagons
 *  [[hexId1, avgProperties1], [hexId2, avgProperties2], ...],
 *  [[hexId1, avgProperties1], [hexId2, avgProperties2], ...],    // highest resoultion, smaller hexagons
 * ]
 */
function gridPointsToHexPoints(gridPoints, averageFn, noise, noise2) {

  let resPoints = []

  for (let res = 7; res <= 10; res++) {
    
    let binnedPoints = {}

    gridPoints.forEach(point => {
      let hexId = h3.latLngToCell(point[1], point[0], res)

      if (hexId in binnedPoints) {
        binnedPoints[hexId].push(point[2])
      }
      else {
        binnedPoints[hexId] = [ point[2] ]
      }
    })

    let points = []

    for (let hexId in binnedPoints) {

      const [centerLat, centerLng] = h3.cellToLatLng(hexId)
      points.push([hexId, averageFn(binnedPoints[hexId], centerLat, centerLng, noise, noise2)])
    }

    resPoints.push(points)
  }

  return resPoints
}

/**
 * 
 * returns array of hexId and growth
 * [[hexId1, growth1], [hexId2, growth2], ...]
 */
function geojsonToHexPoints(dataFeatures, avgFn, noise, noise2) {
  let gridPoints = geojsonToGridPoints(dataFeatures)
  let hexPoints = gridPointsToHexPoints(gridPoints, avgFn, noise, noise2)
  return hexPoints
}

export default class HexTileBorderLayer extends CompositeLayer {

  initializeState() {
    super.initializeState();
    this.setState({
      hextiles: geojsonToHexPoints(this.props.data.features, this.props.averageFn, this.props.noise, this.props.heightNoise),
      // gridps: geojsonToGridPoints(this.props.data.features)
    })
  }

    renderLayers() {

      const { hextiles, gridps } = this.state

      if (!hextiles) return

        let polygons = []

        hextiles[Math.max(Math.min(Math.floor(hextiles.length * this.props.resolution), hextiles.length - 1), 0)].forEach(tile => {

            let tilePolygon = calcPolyBorder(tile[0], this.props.thicknessRange)

            if (this.props.raised)
              polygons.push({
                polygon: tilePolygon.map(hexPoints => hexPoints.map(([x, y]) => [x, y, this.props.getElevation({ properties: tile[1] })])), 
                properties: tile[1],
              })
            else
              polygons.push({
                polygon: tilePolygon, 
                properties: tile[1],
              })
        })

        // count++
        // console.log(`${this.props.id}HexTileBorderLayer`)
        return [
          new SolidPolygonLayer({
            id: `${this.props.id}HexTileBorderLayer`,
            data: polygons,
            getPolygon: d => d.polygon,
            filled: this.props.filled,
            wireframe: this.props.wireframe,
            extruded: this.props.extruded,
            pickable: this.props.pickable,
            getFillColor: this.props.getFillColor,
            getElevation: this.props.getElevation,
            // getElevation: d => d.properties.growth * 3000,
            // getLineColor: this.props.getLineColor,
            getLineWidth: this.props.getLineWidth,
            opacity: this.props.opacity,
            updateTriggers: this.props.updateTriggers,
          }),
        ]
    }
}

HexTileBorderLayer.layerName = 'HexTileBorderLayer'
HexTileBorderLayer.defaultProps = {
  ...CompositeLayer.defaultProps,
  ...SolidPolygonLayer.defaultProps,
  thicknessRange: [0.7, 0.9],
  averageFn: avgObject,
  resolution: 1,
}
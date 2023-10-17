
import { CompositeLayer, SolidPolygonLayer, SimpleMeshLayer } from "deck.gl"
import * as d3Geo from 'd3-geo'
import * as h3 from 'h3-js'
import * as d3 from 'd3'
import { lerp } from '@math.gl/core'

function avg(arr) {
  return arr.reduce((a, b) => a + b) / arr.length
}

function avgObject(arrObjs) {  
  let avgObj = {}

  let propsToAvg = Object.keys(arrObjs[0] || {})

  // avgObj[propsToAvg[0]] = noise.simplex2(centerLat * 10, centerLng *10);
  // avgObj[propsToAvg[1]] = noise2.simplex2(centerLat * 10, centerLng *10);

  propsToAvg.forEach(propToAvg => {
    avgObj[propToAvg] = avg(arrObjs.map(hexPoint => hexPoint[propToAvg]))
    // avgObj[propToAvg] = value / 2 + 0.5
  })

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

  let stepSize = 0.01

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
function gridPointsToHexPoints(gridPoints, averageFn, resRange) {

  let resPoints = []
  let [minRes, maxRes] = resRange

  for (let res = minRes; res <= maxRes; res++) {
    
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
      points.push([hexId, averageFn(binnedPoints[hexId], hexId)])
    }

    resPoints.push(points)
  }

  return resPoints
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
function geojsonToHexPoints(dataFeatures, avgFn, resRange) {
  let gridPoints = geojsonToGridPoints(dataFeatures)
  let hexPoints = gridPointsToHexPoints(gridPoints, avgFn, resRange)
  return hexPoints
}

const FORMATIONS = [    
    /* dot          */ [[0, 0]],
    /* line         */ [[0, 0.33], [0, -0.33]],
    /* triangle     */ [[-0.33, -0.33], [0.33, -0.33], [0, 0.29]],
    /* square       */ [[-0.33, -0.33], [0.33, -0.33], [-0.33, 0.33], [0.33, 0.33]],
    /* house        */ [[-0.33, -0.67], [0.33, -0.67], [-0.33, 0], [0.33, 0], [0, 0.58]],
    /* rectangle    */ [[-0.33, -0.67], [0.33, -0.67], [-0.33, 0], [0.33, 0], [-0.33, 0.67], [0.33, 0.67]],
    /* hexagon      */ [[0, 0], [-0.67, 0], [0.67, 0], [-0.33, 0.58], [0.33, 0.58], [-0.33, -0.58], [0.33, -0.58]],
]

// -- icon layer
// -- altitude
// - answer mentorship email
// - macarthur email about timesheet

const formationInterp = d3.scaleQuantize()
    .domain([0, 1])
    .range(FORMATIONS);

export default class IconHexTileLayer extends CompositeLayer {

  initializeState() {
    super.initializeState();
    this.setState({
      hextiles: geojsonToHexPoints(this.props.data.features, this.props.averageFn, this.props.resRange),
    })
  }

    renderLayers() {

      const { hextiles } = this.state

      if (!hextiles) return

        let data = []

        hextiles[Math.floor((hextiles.length - 1) * this.props.resolution)].forEach(([hexID, properties]) => {

            const [y, x] = h3.cellToLatLng(hexID)
            const edgeLen = h3.getHexagonEdgeLengthAvg(5, h3.UNITS.km) / 250

            for (let [dx, dy] of formationInterp(this.props.getValue({ properties }))) {
                if (this.props.raised)
                data.push({
                  position: [x + dx * edgeLen, y + dy * edgeLen, this.props.getElevation({ properties })],
                  properties,
                })
              else
                data.push({
                  position: [x + dx * edgeLen, y + dy * edgeLen],
                  properties,
                })
            }

        })

        return [
          new SimpleMeshLayer({
            id: `${this.props.id}IconHexTileLayer`,
            data,
            getPosition: d => d.position,
            
            mesh: this.props.mesh,
            texture: this.props.texture,
            sizeScale: this.props.sizeScale,
            wireframe: this.props.wireframe,
            material: this.props.material,
            getColor: this.props.getColor,
            getOrientation: this.props.getOrientation,
            getScale: this.props.getScale,
            getTranslation: this.props.getTranslation,
            getTransformMatrix: this.props.getTransformMatrix,
            textureParameters: this.props.textureParameters,
            
            /* props inherited from Layer class */
            
            autoHighlight: this.props.autoHighlight,
            coordinateOrigin: this.props.coordinateOrigin,
            coordinateSystem: this.props.coordinateSystem,
            highlightColor: this.props.highlightColor,
            loaders: this.props.loaders,
            modelMatrix: this.props.modelMatrix,
            opacity: this.props.opacity,
            pickable: this.props.pickable,
            visible: this.props.visible,
            wrapLongitude: this.props.wrapLongitude,
            updateTriggers: this.props.updateTriggers,
          }),
        ]
    }
}

IconHexTileLayer.layerName = 'IconHexTileLayer'
IconHexTileLayer.defaultProps = {
  ...CompositeLayer.defaultProps,
  ...SimpleMeshLayer.defaultProps,
  thicknessRange: [0.7, 0.9],
  averageFn: avgObject,
  resolution: 0,
  resRange: [5, 5],
  getValue: d => d,
}
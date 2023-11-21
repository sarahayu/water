
import { CompositeLayer, SolidPolygonLayer } from "deck.gl"
import * as d3 from 'd3'
import * as h3 from 'h3-js'
import { lerp } from '@math.gl/core'

function scaleBounds(hexId, paths, value = 1) {

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

function calcPolyBorder(hexId, [thicknessMin, thicknessMax]) {

  // calc hexagonal tile outline boundary
  let bounds = h3.cellToBoundary(hexId).map(p => [p[1], p[0]])

  // scale bounds and create polygons
  let scaledBoundsOuter = scaleBounds(hexId, bounds, thicknessMax)
  let scaledBoundsInner = scaleBounds(hexId, bounds, thicknessMin)
  // let borderPolygons = createBorderPolygons(scaledBoundsOuter, scaledBoundsInner)

  return [scaledBoundsOuter, scaledBoundsInner]
}

export default class SolidHexTileLayer extends CompositeLayer {

  initializeState() {
    super.initializeState();
    this.setState({
      hextiles: this.props.data //geojsonToHexPoints(this.props.data.features, this.props.averageFn, this.props.resRange),
    })
  }

  renderLayers() {

    const { hextiles } = this.state

    if (!hextiles) return

    let polygons = []
    let resIdx = d3.scaleQuantize()
      .domain([0, 1])
      .range([0, hextiles.length - 1])(this.props.resolution)

    console.log(hextiles.length)
    let resHex = hextiles[resIdx]

    Object.keys(resHex).forEach(hexId => {

      let properts = resHex[hexId]

      let tilePolygon = calcPolyBorder(hexId, this.props.thicknessRange)

      if (this.props.raised)
        polygons.push({
          polygon: tilePolygon.map(hexPoints => hexPoints.map(([x, y]) => [x, y, this.props.getElevation({ properties: properts })])),
          properties: properts,
        })
      else
        polygons.push({
          polygon: tilePolygon,
          properties: properts,
        })
    })

    return [
      new SolidPolygonLayer({
        id: `${this.props.id}SolidHexTileLayer`,
        data: polygons,
        getPolygon: d => d.polygon,
        filled: this.props.filled,
        wireframe: this.props.wireframe,
        extruded: this.props.extruded,
        pickable: this.props.pickable,
        getFillColor: this.props.getFillColor,
        getElevation: this.props.getElevation,
        getLineColor: this.props.getLineColor,
        getLineWidth: this.props.getLineWidth,
        opacity: this.props.opacity,
        updateTriggers: this.props.updateTriggers,
      }),
    ]
  }
}

SolidHexTileLayer.layerName = 'SolidHexTileLayer'
SolidHexTileLayer.defaultProps = {
  ...CompositeLayer.defaultProps,
  ...SolidPolygonLayer.defaultProps,
  thicknessRange: [0.7, 0.9],
  resolution: 0,
  resRange: [5, 5],
}
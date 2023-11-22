
import { CompositeLayer, SolidPolygonLayer, SimpleMeshLayer } from "deck.gl"
import * as d3Geo from 'd3-geo'
import * as h3 from 'h3-js'
import * as d3 from 'd3'
import { lerp } from '@math.gl/core'

const FORMATIONS = [
    /* none         */[],
    /* dot          */[[0, 0]],
    /* line         */[[0, 0.33], [0, -0.33]],
    /* triangle     */[[-0.33, -0.33], [0.33, -0.33], [0, 0.29]],
    /* square       */[[-0.33, -0.33], [0.33, -0.33], [-0.33, 0.33], [0.33, 0.33]],
    /* house        */[[-0.33, -0.67], [0.33, -0.67], [-0.33, 0], [0.33, 0], [0, 0.58]],
    /* rectangle    */[[-0.33, -0.67], [0.33, -0.67], [-0.33, 0], [0.33, 0], [-0.33, 0.67], [0.33, 0.67]],
    /* hexagon      */[[0, 0], [-0.67, 0], [0.67, 0], [-0.33, 0.58], [0.33, 0.58], [-0.33, -0.58], [0.33, -0.58]],
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
      hextiles: this.props.data,
    })
  }

  renderLayers() {

    const { hextiles } = this.state

    if (!hextiles) return

    let data = []

    let resIdx = d3.scaleQuantize()
      .domain([0, 1])
      .range(d3.range(0, hextiles.length))(this.props.resolution)
    let curRes = d3.scaleQuantize()
      .domain([0, 1])
      .range(d3.range(this.props.resRange[0], this.props.resRange[1] + 1))(this.props.resolution)
    
    // console.log(resIdx)

    let resHex = hextiles[resIdx]
    const edgeLen = h3.getHexagonEdgeLengthAvg(curRes, h3.UNITS.km) / 250 * 1.75
    let iconScale = h3.getHexagonEdgeLengthAvg(curRes, h3.UNITS.km) / h3.getHexagonEdgeLengthAvg(5, h3.UNITS.km)

    // console.log(iconScale)

    Object.keys(resHex).forEach(hexID => {
      let properties = resHex[hexID]

      const [y, x] = h3.cellToLatLng(hexID)

      for (let [dx, dy] of this.props.getValue ? formationInterp(this.props.getValue({ properties })) : FORMATIONS[1]) {

        let [ddx, ddy] = this.props.offset
        if (this.props.raised)
          data.push({
            position: [x + dx * edgeLen + ddx * edgeLen, y + dy * edgeLen + ddy * edgeLen, this.props.getElevation({ properties })],
            properties,
          })
        else
          data.push({
            position: [x + dx * edgeLen + ddx * edgeLen, y + dy * edgeLen + ddy * edgeLen],
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
        sizeScale: this.props.sizeScale * iconScale,
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
  resolution: 0,
  resRange: [5, 5],
  getValue: undefined,
  offset: [0, 0],
}
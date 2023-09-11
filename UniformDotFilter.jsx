import {LayerExtension} from '@deck.gl/core';

export default class UniformDotFilter extends LayerExtension {
  constructor({ pointsOffset }) {
    super({ pointsOffset })
  }

  updateState(params, extension) {
    const {pointsOffset} = extension.opts;
    console.log(extension.opts)
    for (const model of this.getModels()) {
      model.setUniforms({pointsOffset});
    }
  }
  getShaders() {
    return {
      inject: {
        'vs:#decl': `
            varying vec2 worldPos;
        `,
        'vs:#main-end': `
            worldPos = positions.xy;
        `,
        'vs:DECKGL_FILTER_SIZE': `
            // gl_FragColor = vColor;
        `,
        'vs:DECKGL_FILTER_GL_POSITION': `
            // gl_FragColor = vColor;
        `,
        'fs:#decl': `
            varying vec2 worldPos;
            uniform vec2 pointsOffset;
        `,
        'fs:#main-end': `
          vec2 normPos = worldPos * vec2(1.0, 1.5);

          float scale = 10000.0;
          float spacing = 1.5;
          vec2 nearest = normPos * scale / spacing;
          nearest.y = floor(nearest.y + 0.5 + pointsOffset.y);
          float off = mod(nearest.y, 2.0) / 2.0;
          nearest.y -= pointsOffset.y;
          nearest.x = floor(nearest.x + 0.5 + off + pointsOffset.x) - off - pointsOffset.x;
          nearest *= 1.0 / scale * spacing;
          float dist = distance(nearest, normPos);
          dist *= scale;
          if (dist > 0.5) discard;
          `,
        'fs:DECKGL_FILTER_COLOR': `
            gl_FragColor.rgb = color.rgb * 2.0;
        `,
      }
    };
  }

  // draw(params, extension) {
  //   const {uniforms} = params
  //   console.log(extension.opts)

  //   super.draw({ uniforms, ...extension.opts })
  // }

  // updateState(params) {
  //   console.log(this.opts)
  //   const {myColor} = this.opts;
  //   for (const model of this.getModels()) {
  //     model.setUniforms({myColor});
  //   }
  // }
  
  // getSubLayerProps(params) {
  //   const {myColor} = params.props;
  //   return {
  //     myColor
  //   };
  // }
  // getShaders() {
  //   // use object.assign to make sure we don't overwrite existing fields like `vs`, `modules`...
  //   return Object.assign({}, super.getShaders(), {
  //     fs: `\
  //     #define SHADER_NAME uniform-dot-layer-fragment-shader
      
      
  //     void main(void) {
      
  //       gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0);
  //     }
  //     `
  //   });
  // }

  // updateState(params) {
  //   const {highlightRed = true} = params.props;
  //   for (const model of this.getModels()) {
  //     model.setUniforms({highlightRed});
  //   }
  // }

  // getSubLayerProps() {
  //   const {highlightRed = true} = params.props;
  //   return {
  //     highlightRed
  //   };
  // }
}
'use strict';

const fs = require('fs');
const resl = require('resl');
const {mat4} = require('gl-matrix');

const Input = require('../utils/input');
const camera = require('../utils/camera/free-camera');
const grid = require('../utils/grid/grid');
const coord = require('../utils/coord');

const identity = mat4.identity([]);

let gltf = JSON.parse( fs.readFileSync( Editor.url('app://examples/gltf-exports/scene.gltf') ) );
console.log(gltf);

let vshader = `
  precision mediump float;
  uniform mat4 model, view, projection;

  attribute vec3 a_position;
  attribute vec3 a_normal;
  attribute vec2 a_uv0;

  varying vec2 v_uv0;

  void main() {
    v_uv0 = a_uv0;
    gl_Position = projection * view * model * vec4(a_position, 1);
  }
`;

let fshader = `
  #extension GL_OES_standard_derivatives : enable

  precision mediump float;
  uniform sampler2D u_mainTexture;

  varying vec2 v_uv0;

  void main () {
    // gl_FragColor = vec4( 1, 1, 1, 1 );
    // gl_FragColor = vec4( v_uv0.x, v_uv0.y, 0, 1 );

    gl_FragColor = texture2D( u_mainTexture, v_uv0 );

    if (!gl_FrontFacing) {
      gl_FragColor *= 0.05;
    }
  }
`;

function _walk ( node, fn ) {
  node.children.forEach(child => {
    fn ( node, child );
    _walk( child, fn );
  });
}

function _recurseNode ( node, childrenIDs ) {
  childrenIDs.forEach(nodeID => {
    let gltfNode = gltf.nodes[nodeID];

    let childNode = {
      name: gltfNode.name,
      parent: node,
      children: [],

      // TODO: how about matrix??
      position: gltfNode.translation || [0,0,0],
      rotation: gltfNode.rotation || [0,0,0,1],
      scale: gltfNode.scale || [1,1,1],

      // optional
      meshes: gltfNode.meshes,
    };

    node.children.push(childNode);

    if ( gltfNode.children ) {
      _recurseNode ( childNode, gltfNode.children );
    }
  });
}

function _type2buffertype ( regl, type ) {
  if ( type === regl._gl.BYTE ) {
    return 'int8';
  } else if ( type === regl._gl.UNSIGNED_BYTE ) {
    return 'uint8';
  } else if ( type === regl._gl.SHORT ) {
    return 'int16';
  } else if ( type === regl._gl.UNSIGNED_SHORT ) {
    return 'uint16';
  } else if ( type === regl._gl.FLOAT ) {
    return 'float';
  }

  return 'float';
}

function _type2buffersize ( regl, type ) {
  if ( type === 'SCALAR' ) {
    return 1;
  } else if ( type === 'VEC2' ) {
    return 2;
  } else if ( type === 'VEC3' ) {
    return 3;
  } else if ( type === 'VEC4' ) {
    return 4;
  } else if ( type === 'MAT2' ) {
    return 4;
  } else if ( type === 'MAT3' ) {
    return 9;
  } else if ( type === 'MAT4' ) {
    return 16;
  }

  return 1;
}

function _mode2primitive ( regl, mode ) {
  if ( mode === regl._gl.POINTS ) {
    return 'points';
  } else if ( mode === regl._gl.LINES ) {
    return 'lines';
  } else if ( mode === regl._gl.LINE_LOOP ) {
    return 'line loop';
  } else if ( mode === regl._gl.LINE_STRIP ) {
    return 'line strip';
  } else if ( mode === regl._gl.TRIANGLES ) {
    return 'triangles';
  } else if ( mode === regl._gl.TRIANGLE_STRIP ) {
    return 'triangle strip';
  } else if ( mode === regl._gl.TRIANGLE_FAN ) {
    return 'triangle fan';
  }

  return 'triangles';
}

module.exports = function (regl) {

  let bufferReady = false;

  // =================
  // builtin techniques & programs
  // =================

  //
  let builtinPrograms = {
    diffuse: {
      attributes: [ 'a_position', 'a_normal', 'a_uv0' ],
      vertexShader: vshader,
      fragmentShader: fshader,
    }
  };

  let _programs = {};
  for ( let name in builtinPrograms ) {
    _programs[name] = builtinPrograms[name];
  }
  for ( let name in gltf.programs ) {
    _programs[name] = gltf.programs[name];
  }

  //
  let builtinTechniques = {
    diffuse: {
      name: 'diffuse',
      program: 'diffuse',
      parameters: {
        position: {
          type: regl._gl.FLOAT_VEC3,
          semantic: 'POSITION'
        },
        normal: {
          type: regl._gl.FLOAT_VEC3,
          semantic: 'NORMAL'
        },
        uv0: {
          type: regl._gl.FLOAT_VEC2,
          semantic: 'TEXCOORD_0'
        },
        model: {
          type: regl._gl.FLOAT_MAT4,
          semantic: 'MODEL'
        },
        view: {
          type: regl._gl.FLOAT_MAT4,
          semantic: 'VIEW'
        },
        projection: {
          type: regl._gl.FLOAT_MAT4,
          semantic: 'PROJECTION'
        },
        mainTexture: {
          type: regl._gl.SAMPLER_2D,
        },
      },

      attributes: {
        a_position: 'position',
        a_normal: 'normal',
        a_uv0: 'uv0',
      },

      uniforms: {
        model: 'model',
        // view: 'view',
        // projection: 'projection',
        u_mainTexture: 'mainTexture',
      },
    },
  };

  let _techniques = {};
  for ( let name in builtinTechniques ) {
    _techniques[name] = builtinTechniques[name];
  }
  for ( let name in gltf.techniques ) {
    _techniques[name] = gltf.techniques[name];
  }

  // =================
  // scene
  // =================

  let gltfScene = gltf.scenes[gltf.scene];
  let scene = {
    name: gltfScene.name,
    children: [],
    world: identity,
  };

  // =================
  // techniques & drawCommands
  // =================

  let techniques = {};
  let drawCommands = {};

  for ( let techID in _techniques ) {
    let gltfTechnique = _techniques[techID];

    let tech = {
      name: gltfTechnique.name,
      program: _programs[gltfTechnique.program],
      parameters: gltfTechnique.parameters,
      attributes: gltfTechnique.attributes,
      uniforms: gltfTechnique.uniforms,
    };

    // draw options
    let opts = {
      frontFace: 'ccw',

      vert: tech.program.vertexShader,
      frag: tech.program.fragmentShader,

      primitive: regl.prop('primitive'),
      offset: regl.prop('offset'),
      count: regl.prop('count'),

      elements: regl.prop('elements'),
      attributes: {},
      uniforms: {},
    };
    for ( let attrName in tech.attributes ) {
      opts.attributes[attrName] = regl.prop('attributes.' + attrName);
    }
    for ( let uniformName in tech.uniforms ) {
      opts.uniforms[uniformName] = regl.prop('uniforms.' + uniformName);
    }
    // TODO: states
    // TODO: functions

    // finalize
    techniques[techID] = tech;
    drawCommands[techID] = regl(opts);
  }

  // =================
  // nodes
  // =================

  _recurseNode(scene, gltfScene.nodes);
  _walk(scene, (parent, child) => {
    child.local = mat4.fromRotationTranslationScale(
      [],
      child.rotation,
      child.position,
      child.scale
    );
    child.world = mat4.multiply([], parent.world, child.local);
    child.parent = parent;
  });

  // =================
  // textures
  // =================

  let manifest = {};
  let textures = {};

  for ( let name in gltf.textures ) {
    let gltfTexture = gltf.textures[name];
    let gltfImage = gltf.images[gltfTexture.source];
    // TODO:
    // let gltfSampler = gltf.sampler[gltfTexture.sampler];

    textures[name] = regl.texture({
      mag: 'linear',
      min: 'mipmap',
      mipmap: 'nice',
      flipY: true
    });
    manifest[name] = {
      type: 'image',
      src: 'examples/gltf-exports/' + gltfImage.uri
    };
  }
  resl({
    manifest: manifest,
    onDone: (assets) => {
      for ( let name in assets ) {
        textures[name]({
          data: assets[name]
        });
      }
    }
  });

  // =================
  // buffers & bufferViews
  // =================

  manifest = {};
  let buffer2viewIDs = {};
  let bufferViews = {};

  for ( let id in gltf.buffers ) {
    let gltfBuffer = gltf.buffers[id];
    buffer2viewIDs[id] = [];

    manifest[id] = {
      type: 'binary',
      src: 'examples/gltf-exports/' + gltfBuffer.uri
    };
  }

  for ( let id in gltf.bufferViews ) {
    let gltfBufferView = gltf.bufferViews[id];
    if ( gltfBufferView.target === regl._gl.ARRAY_BUFFER ) {
      bufferViews[id] = regl.buffer(gltfBufferView.byteLength);
    } else if ( gltfBufferView.target === regl._gl.ELEMENT_ARRAY_BUFFER ) {
      bufferViews[id] = regl.elements(gltfBufferView.byteLength);
    }

    buffer2viewIDs[gltfBufferView.buffer].push(id);
  }

  resl({
    manifest: manifest,
    onDone: (assets) => {
      for ( let id in assets ) {
        let viewIDs = buffer2viewIDs[id];
        viewIDs.forEach(viewID => {
          let gltfBufferView = gltf.bufferViews[viewID];
          let reglBuf = bufferViews[viewID];
          reglBuf({
            type: 'uint16', // HACK
            data: new Uint8Array(assets[id], gltfBufferView.byteOffset, gltfBufferView.byteLength)
          });
        });
      }

      bufferReady = true;
    }
  });

  // =================
  // meshes
  // =================

  let meshes = {};

  for ( let meshID in gltf.meshes ) {
    let gltfMesh = gltf.meshes[meshID];
    let mesh = {
      name: gltfMesh.name,
      infos: [],
    };

    // dump primitives
    gltfMesh.primitives.forEach(gltfPrimitive => {
      // get material & technique
      let gltfMaterial = gltf.materials[gltfPrimitive.material];
      let tech = techniques[gltfMaterial.technique];

      //
      let info = {
        id: tech.name,
        primitive: _mode2primitive(regl, gltfPrimitive.mode),
        attributes: {},
        uniforms: {},
      };

      // get attribute accessor
      tech.program.attributes.forEach(attrName => {
        let paramName = tech.attributes[attrName];
        let param = tech.parameters[paramName];

        let accessorID = gltfPrimitive.attributes[param.semantic];
        if ( !accessorID ) {
          console.warn(`can not find attribute by semantic ${param.semantic}`);
          return;
        }

        let accessor = gltf.accessors[accessorID];
        info.attributes[attrName] = {
          buffer: bufferViews[accessor.bufferView],
          offset: accessor.byteOffset,
          stride: accessor.byteStride,
          // type: _type2buffertype( regl, accessor.componentType ),
          type: accessor.componentType,
          size: _type2buffersize( regl, accessor.type ),
        };
      });

      // get uniforms
      for ( let name in tech.uniforms ) {
        let paramName = tech.uniforms[name];
        let param = tech.parameters[paramName];

        let value = gltfMaterial.values[paramName];
        if ( value !== undefined ) {
          if ( param.type === regl._gl.SAMPLER_2D ) {
            info.uniforms[name] = textures[value];
          } else {
            info.uniforms[name] = value;
          }
          continue;
        }

        // use default value
        if ( param.value !== undefined ) {
          if ( param.type === regl._gl.SAMPLER_2D ) {
            info.uniforms[name] = textures[param.value];
          } else {
            info.uniforms[name] = value;
          }
        }
      }

      // get indices accessor
      if ( gltfPrimitive.indices ) {
        let accessor = gltf.accessors[gltfPrimitive.indices];
        info.elements = bufferViews[accessor.bufferView]({
          count: accessor.count
        });
        info.offset = accessor.byteOffset;
        info.count = accessor.count;
      }

      // TODO: states

      mesh.infos.push(info);
    });

    meshes[meshID] = mesh;
  }

  // =================
  // draws
  // =================

  let input = new Input(regl);
  let drawGrid = grid(regl, 100, 100, 100);
  let drawCoord = coord(regl);

  // build the hierarchy
  let updateCamera = camera(regl, {
    eye: [10, 10, 10, 1],
    phi: -Math.PI / 6,
    theta: Math.PI / 4,
  });

  regl.frame(() => {
    // clear contents of the drawing buffer
    regl.clear({
      color: [0.3, 0.3, 0.3, 1],
      depth: 1
    });

    updateCamera(input, () => {
      _walk(scene, (parent, child) => {
        drawCoord(child.world);

        //
        if ( bufferReady ) {
          if ( child.meshes ) {
            child.meshes.forEach(id => {
              let mesh = meshes[id];
              mesh.infos.forEach(info => {
                info.uniforms.model = child.world;

                let cmd = drawCommands[info.id];
                cmd(info);
              });
            });
          }
        }
      });

      drawGrid();
      drawCoord(mat4.fromTranslation([], [0, 0.01, 0]));
    });

    input.reset();
  });
};

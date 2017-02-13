'use strict';

const fs = require('fs');
const resl = require('resl');
const {vec3, quat, mat4} = require('gl-matrix');

const Input = require('../utils/input');
const camera = require('../utils/camera/free-camera');
const grid = require('../utils/grid/grid');
const coord = require('../utils/coord');

const quad = require('glsl-quad');
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

let vshader_skinning = `
  precision mediump float;
  uniform mat4 model, view, projection;

  attribute vec3 a_position;
  attribute vec3 a_normal;
  attribute vec2 a_uv0;
  attribute vec4 a_weight;
  attribute vec4 a_joint;

  uniform sampler2D u_bonesTexture;
  uniform float u_bonesTextureSize;

  varying vec2 v_uv0;

  mat4 getBoneMatrix(const in float i) {
    float size = u_bonesTextureSize;
    float j = i * 4.0;
    float x = mod(j, size);
    float y = floor(j / size);

    float dx = 1.0 / size;
    float dy = 1.0 / size;

    y = dy * (y + 0.5);

    vec4 v1 = texture2D(u_bonesTexture, vec2(dx * (x + 0.5), y));
    vec4 v2 = texture2D(u_bonesTexture, vec2(dx * (x + 1.5), y));
    vec4 v3 = texture2D(u_bonesTexture, vec2(dx * (x + 2.5), y));
    vec4 v4 = texture2D(u_bonesTexture, vec2(dx * (x + 3.5), y));

    mat4 bone = mat4(v1, v2, v3, v4);

    return bone;
  }

  void main() {
    v_uv0 = a_uv0;
    mat4 matSkin =
      getBoneMatrix(a_joint.x) * a_weight.x +
      getBoneMatrix(a_joint.y) * a_weight.y +
      getBoneMatrix(a_joint.z) * a_weight.z +
      getBoneMatrix(a_joint.w) * a_weight.w ;

    gl_Position = projection * view * model * matSkin * vec4(a_position, 1);
  }
`;

let fshader_skinning = `
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

function _binaryIndexOf ( array, key ) {
  let lo = 0;
  let hi = array.length - 1;
  let mid;

  while (lo <= hi) {
    mid = ((lo + hi) >> 1);
    let val = array[mid];

    if (val < key) {
      lo = mid + 1;
    } else if (val > key) {
      hi = mid - 1;
    } else {
      return mid;
    }
  }

  return lo;
}

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
      id: nodeID,
      name: gltfNode.name,
      parent: node,
      children: [],

      // TODO: how about matrix??
      position: gltfNode.translation || [0,0,0],
      rotation: gltfNode.rotation || [0,0,0,1],
      scale: gltfNode.scale || [1,1,1],

      // optional
      meshes: gltfNode.meshes,
      skeletons: gltfNode.skeletons,
      skin: gltfNode.skin,
      // joints: {}, // id to jointNode
      // bones: [], // node IDs

      // extras
      extras: gltfNode.extras,
    };

    node.children.push(childNode);

    if ( gltfNode.children ) {
      _recurseNode ( childNode, gltfNode.children );
    }
  });
}

function _recurseJoint ( joints, parent, nodeID ) {
  let node = joints[nodeID];
  if ( node ) {
    if ( parent ) {
      node.parent = parent;
      parent.children.push(node);
    }

    return;
  }

  let gltfNode = gltf.nodes[nodeID];

  node = {
    id: nodeID,
    name: gltfNode.name,
    jointName: gltfNode.jointName,
    parent: parent,
    children: [],

    // TODO: how about matrix??
    position: gltfNode.translation || [0,0,0],
    rotation: gltfNode.rotation || [0,0,0,1],
    scale: gltfNode.scale || [1,1,1],
  };
  joints[nodeID] = node;

  if ( parent ) {
    parent.children.push(node);
  }

  if ( gltfNode.children ) {
    gltfNode.children.forEach(childNodeID => {
      _recurseJoint(joints, node, childNodeID);
    });
  }
}

function _findJointByName ( node, name ) {
  if ( node.jointName === name ) {
    return node;
  }

  for ( let i = 0; i < node.children.length; ++i ) {
    let child = node.children[i];
    let result = _findJointByName(child, name);

    if ( result ) {
      return result;
    }
  }

  return null;
}

function _duplicateJoint ( node ) {
  let newNode = {
    id: node.id,
    name: node.name,
    jointName: node.jointName,
    parent: node.parent,
    children: [],

    position: node.position.slice(0),
    rotation: node.rotation.slice(0),
    scale: node.scale.slice(0),

    local: node.local,
    world: node.world,
  };

  for (let i = 0; i < node.children.length; i++) {
    let newChildNode = _duplicateJoint(node.children[i]);
    newNode.children.push(newChildNode);
    newChildNode.parent = newNode;
  }

  return newNode;
}

function _getRootJoint ( node ) {
  let result = node;

  while (1) {
    let parent = result.parent;
    if ( !parent ) {
      return result;
    }

    result = parent;
  }
}

// function _type2buffertype ( regl, type ) {
//   if ( type === regl._gl.BYTE ) {
//     return 'int8';
//   } else if ( type === regl._gl.UNSIGNED_BYTE ) {
//     return 'uint8';
//   } else if ( type === regl._gl.SHORT ) {
//     return 'int16';
//   } else if ( type === regl._gl.UNSIGNED_SHORT ) {
//     return 'uint16';
//   } else if ( type === regl._gl.FLOAT ) {
//     return 'float';
//   }

//   return 'float';
// }

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

function _primitive2drawinfo (regl, gltfPrimitive, techniques, textures, bufferViews, useSkin) {
  // get material & technique
  let gltfMaterial = gltf.materials[gltfPrimitive.material];
  let techID = useSkin ? gltfMaterial.technique + '_skinning' : gltfMaterial.technique;
  let tech = techniques[techID];

  let info = {
    techID: techID,
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
    info.elements = bufferViews[accessor.bufferView];
    info.offset = accessor.byteOffset;
    info.count = accessor.count;
  }

  // TODO: states

  return info;
}

function _updateBonesTexture(animNode, joints) {
  let bonesTexture = animNode.bonesTexture;
  let size = bonesTexture.width;
  let result = new Array(size * size * 4);

  for ( let i = 0; i < animNode.bones.length; ++i ) {
    let bindpose = animNode.bindposes[i];

    let jointID = animNode.bones[i];
    let joint = joints[jointID];
    let mat = mat4.multiply([], joint.world, bindpose);

    result[16*i + 0 ] = mat[0 ];
    result[16*i + 1 ] = mat[1 ];
    result[16*i + 2 ] = mat[2 ];
    result[16*i + 3 ] = mat[3 ];
    result[16*i + 4 ] = mat[4 ];
    result[16*i + 5 ] = mat[5 ];
    result[16*i + 6 ] = mat[6 ];
    result[16*i + 7 ] = mat[7 ];
    result[16*i + 8 ] = mat[8 ];
    result[16*i + 9 ] = mat[9 ];
    result[16*i + 10] = mat[10];
    result[16*i + 11] = mat[11];
    result[16*i + 12] = mat[12];
    result[16*i + 13] = mat[13];
    result[16*i + 14] = mat[14];
    result[16*i + 15] = mat[15];
  }

  // store data in bone texture;
  bonesTexture.subimage(result);
}

module.exports = function (regl) {
  // const debugDraw = regl({
  //   depth: {
  //     enable: false,
  //   },

  //   viewport: {
  //     x: 5,
  //     y: 5,
  //     width: 160,
  //     height: 90,
  //   },

  //   blend: {
  //     enable: false,
  //     func: {
  //       srcRGB: 'src alpha',
  //       srcAlpha: 1,
  //       dstRGB: 'one minus src alpha',
  //       dstAlpha: 1
  //     },
  //   },

  //   vert: `
  //     precision mediump float;
  //     attribute vec2 a_position;
  //     attribute vec2 a_uv;

  //     varying vec2 v_uv;

  //     void main() {
  //       v_uv = a_uv;
  //       gl_Position = vec4(a_position, 0, 1);
  //     }
  //   `,

  //   frag: `
  //     precision mediump float;
  //     varying vec2 v_uv;

  //     uniform sampler2D u_tex;

  //     void main () {
  //       gl_FragColor = texture2D(u_tex,v_uv);
  //     }
  //   `,

  //   attributes: {
  //     a_position: quad.verts,
  //     a_uv: quad.uvs
  //   },
  //   elements: quad.indices,
  //   uniforms: {
  //     u_tex: regl.prop('texture'),
  //   },
  // });

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
    },

    diffuse_skinning: {
      attributes: [ 'a_position', 'a_normal', 'a_uv0', 'a_joint', 'a_weight' ],
      vertexShader: vshader_skinning,
      fragmentShader: fshader_skinning,
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

    diffuse_skinning: {
      name: 'diffuse_skinning',
      program: 'diffuse_skinning',
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
        joint: {
          type: regl._gl.FLOAT_VEC4,
          semantic: 'JOINT'
        },
        weight: {
          type: regl._gl.FLOAT_VEC4,
          semantic: 'WEIGHT'
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
        bonesTexture: {
          type: regl._gl.SAMPLER_2D,
        },
        bonesTextureSize: {
          type: regl._gl.FLOAT,
        },
      },

      attributes: {
        a_position: 'position',
        a_normal: 'normal',
        a_uv0: 'uv0',
        a_joint: 'joint',
        a_weight: 'weight',
      },

      uniforms: {
        model: 'model',
        // view: 'view',
        // projection: 'projection',
        u_bonesTexture: 'bonesTexture',
        u_bonesTextureSize: 'bonesTextureSize',
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
  let joints = {};

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
      // frontFace: 'ccw',
      cull: {
        enable: true,
        face: 'back'
      },

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
  });

  // =================
  // joints
  // =================

  for ( let id in gltf.nodes ) {
    let node = gltf.nodes[id];
    if ( node.jointName ) {
      _recurseJoint( joints, null, id );
    }
  }

  for ( let id in joints ) {
    let joint = joints[id];

    // this is not root joint
    if ( joint.parent ) {
      continue;
    }

    joint.local = mat4.fromRotationTranslationScale(
      [],
      joint.rotation,
      joint.position,
      joint.scale
    );
    joint.world = mat4.fromRotationTranslationScale(
      [],
      joint.rotation,
      joint.position,
      joint.scale
    );
    _walk(joint, (parent, child) => {
      child.local = mat4.fromRotationTranslationScale(
        [],
        child.rotation,
        child.position,
        child.scale
      );
      child.world = mat4.multiply([], parent.world, child.local);
    });
  }

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

    textures[name] = regl.texture();
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
          data: assets[name],
          wrapS: 'repeat',
          wrapT: 'repeat',
          mag: 'linear',
          min: 'mipmap',
          mipmap: 'nice',
          flipY: true
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

  // nodeID_to_skin
  // animID to animations
  let animations = {};

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
    } else {
      bufferViews[id] = new ArrayBuffer();
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
          if ( gltfBufferView.target ) {
            let reglBuf = bufferViews[viewID];
            reglBuf({
              type: 'uint16', // HACK
              data: new Uint8Array(assets[id], gltfBufferView.byteOffset, gltfBufferView.byteLength)
            });
          } else {
            // ArrayBuffer.slice
            bufferViews[viewID] = assets[id].slice(
              gltfBufferView.byteOffset,
              gltfBufferView.byteOffset + gltfBufferView.byteLength
            );
          }
        });
      }

      bufferReady = true;

      // =================
      // skins
      // =================

      _walk(scene, (parent, child) => {
        if ( child.extras && child.extras.root ) {
          let cloneJoints = {};
          let root = joints[child.extras.root];
          let cloneRoot = _duplicateJoint(root);
          cloneRoot.local = mat4.identity([]);
          cloneRoot.local2 = mat4.clone(cloneRoot.local);
          cloneJoints[cloneRoot.id] = cloneRoot;

          _walk(cloneRoot, (parent, child) => {
            child.local2 = mat4.clone(child.local);
            cloneJoints[child.id] = child;
          });
          child.joints = cloneJoints;
        }

        if ( child.skin && child.skeletons ) {
          // already did it
          if ( child.bonesTexture ) {
            return;
          }

          if ( child.parent && child.parent.extras && child.parent.extras.root ) {
            child.joints = child.parent.joints;
          } else {
            let cloneJoints = {};
            for ( let i = 0; i < child.skeletons.length; ++i ) {
              let jointID = child.skeletons[i];
              let root = joints[jointID];
              root = _getRootJoint(root);

              let cloneRoot = _duplicateJoint(root);
              cloneRoot.local = mat4.identity([]);
              cloneRoot.local2 = mat4.clone(cloneRoot.local);
              cloneJoints[cloneRoot.id] = cloneRoot;

              _walk(cloneRoot, (parent, child) => {
                child.local2 = mat4.clone(child.local);
                cloneJoints[child.id] = child;
              });
            }
            child.joints = cloneJoints;
          }

          let gltfSkin = gltf.skins[child.skin];
          let accessor = gltf.accessors[gltfSkin.inverseBindMatrices];
          let bones = [];
          let bindposes = [];

          let bufferView = bufferViews[accessor.bufferView];
          let data = new Float32Array(bufferView, accessor.byteOffset, accessor.count * 16);

          gltfSkin.jointNames.forEach(name => {
            let found = false;

            for ( let i = 0; i < child.skeletons.length; ++i ) {
              let jointID = child.skeletons[i];
              let root = child.joints[jointID];
              root = _getRootJoint(root);

              let result = _findJointByName(root, name);
              if ( result ) {
                bones.push(result.id);
                found = true;
                break;
              }
            }

            if ( !found ) {
              console.error(`Can not find joint: ${name}`);
            }
          });
          child.bones = bones;

          let size;
          if (bones.length > 256) {
            size = 64;
          } else if (bones.length > 64) {
            size = 32;
          } else if (bones.length > 16) {
            size = 16;
          } else {
            size = 8;
          }

          let result = new Array(size * size * 4);
          for ( let i = 0; i < bones.length; ++i ) {
            let bindpose = [
              data[16*i + 0],  data[16*i + 1],  data[16*i + 2],  data[16*i + 3],
              data[16*i + 4],  data[16*i + 5],  data[16*i + 6],  data[16*i + 7],
              data[16*i + 8],  data[16*i + 9],  data[16*i + 10], data[16*i + 11],
              data[16*i + 12], data[16*i + 13], data[16*i + 14], data[16*i + 15],
            ];
            bindposes.push(bindpose);

            // let mat = mat4.multiply([], iv_global, bones[i].world, bindpose, bindshape);
            let joint = child.joints[bones[i]];
            let mat = mat4.multiply([], joint.world, bindpose);

            result[16*i + 0 ] = mat[0 ];
            result[16*i + 1 ] = mat[1 ];
            result[16*i + 2 ] = mat[2 ];
            result[16*i + 3 ] = mat[3 ];
            result[16*i + 4 ] = mat[4 ];
            result[16*i + 5 ] = mat[5 ];
            result[16*i + 6 ] = mat[6 ];
            result[16*i + 7 ] = mat[7 ];
            result[16*i + 8 ] = mat[8 ];
            result[16*i + 9 ] = mat[9 ];
            result[16*i + 10] = mat[10];
            result[16*i + 11] = mat[11];
            result[16*i + 12] = mat[12];
            result[16*i + 13] = mat[13];
            result[16*i + 14] = mat[14];
            result[16*i + 15] = mat[15];
          }
          child.bindposes = bindposes;

          // store data in bone texture;
          child.bonesTexture = regl.texture({
            width: size,
            height: size,
            format: 'rgba',
            type: 'float32',
            wrapS: 'clamp',
            wrapT: 'clamp',
            mag: 'nearest',
            min: 'nearest',
            mipmap: false,
            flipY: false
          });
          child.bonesTexture.subimage(result);
        }
      });

      // =================
      // animations
      // =================

      for ( let animID in gltf.animations ) {
        let gltfAnimation = gltf.animations[animID];
        let anim = {
          name: gltfAnimation.name,
          length: 0,
          keyframes: {},
        };

        let maxLength = 0;
        gltfAnimation.channels.forEach(channel => {
          let gltfAnimSampler = gltfAnimation.samplers[channel.sampler];
          let gltfTarget = channel.target;

          let keyframes = anim.keyframes[gltfAnimSampler.input];
          if ( !keyframes ) {
            let accID = gltfAnimation.parameters[gltfAnimSampler.input];
            let acc = gltf.accessors[accID];
            let bufferView = bufferViews[acc.bufferView];
            let data = new Float32Array(bufferView, acc.byteOffset, acc.count);

            keyframes = {
              times: data,
              bones: [],
            };
            anim.keyframes[gltfAnimSampler.input] = keyframes;

            let length = data[acc.count-1];
            if ( maxLength < length ) {
              maxLength = length;
            }
          }

          //
          let bone;
          for ( let i = 0; i < keyframes.bones.length; ++i ) {
            let b = keyframes.bones[i];
            if ( b.id === gltfTarget.id ) {
              bone = b;
              break;
            }
          }
          if ( !bone ) {
            bone = {
              id: gltfTarget.id,
            };
            keyframes.bones.push(bone);
          }

          let prop = gltfTarget.path;
          let accID = gltfAnimation.parameters[gltfAnimSampler.output];
          let acc = gltf.accessors[accID];
          let bufferView = bufferViews[acc.bufferView];

          if ( prop === 'rotation' ) {
            let data = new Float32Array(bufferView, acc.byteOffset, acc.count * 4);
            bone[prop] = new Array(acc.count);
            for ( let i = 0; i < acc.count; ++i ) {
              bone[prop][i] = [
                data[4 * i + 0],
                data[4 * i + 1],
                data[4 * i + 2],
                data[4 * i + 3],
              ];
            }
          } else {
            let data = new Float32Array(bufferView, acc.byteOffset, acc.count * 3);
            bone[prop] = new Array(acc.count);
            for ( let i = 0; i < acc.count; ++i ) {
              bone[prop][i] = [
                data[3 * i + 0],
                data[3 * i + 1],
                data[3 * i + 2],
              ];
            }
          }
        });

        anim.length = maxLength;
        animations[animID] = anim;
      }
    }
  });

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

    updateCamera(input, ({time}) => {
      if ( bufferReady ) {
        _walk(scene, (parent, child) => {
          drawCoord(child.world);

          // update animations
          if ( child.extras && child.extras.animations ) {
            let id = child.extras.animations[0];
            let anim = animations[id];
            let snapshot = {};

            let t = time % anim.length;
            for ( let p in anim.keyframes ) {
              let keyframes = anim.keyframes[p];
              let idx = _binaryIndexOf(keyframes.times, t);

              let loIdx = Math.max(idx-1, 0);
              let hiIdx = Math.min(idx, keyframes.times.length);
              let ratio = (t - keyframes.times[loIdx]) / (keyframes.times[hiIdx] - keyframes.times[loIdx]);

              // console.log(`current time ${t}, idx = ${idx} lo = ${keyframes.times[loIdx]}, hi = ${keyframes.times[hiIdx]}`);
              keyframes.bones.forEach(bone => {
                let t, s, r;

                if ( bone.translation ) {
                  let a = bone.translation[loIdx];
                  let b = bone.translation[hiIdx];
                  t = vec3.lerp([], a, b, ratio);
                }
                if ( bone.scale ) {
                  let a = bone.scale[loIdx];
                  let b = bone.scale[hiIdx];
                  s = vec3.lerp([], a, b, ratio);
                }
                if ( bone.rotation ) {
                  let a = bone.rotation[loIdx];
                  let b = bone.rotation[hiIdx];
                  r = quat.slerp([], a, b, ratio);
                }

                let joint = child.joints[bone.id];
                mat4.fromRotationTranslationScale(
                  joint.local2,
                  r || joint.rotation,
                  t || joint.position,
                  s || joint.scale
                );
              });
            }

            // update joints' world transform
            let root = child.joints[child.extras.root];
            if ( root.parent ) {
              root.world = mat4.multiply([], root.parent.world, root.local2);
            } else {
              root.world = root.local2;
            }
            _walk(root, (parent, child) => {
              child.world = mat4.multiply([], parent.world, child.local2);
            });

            // update child bones
            for ( let i = 0; i < child.children.length; ++i ) {
              let animNode = child.children[i];
              if ( animNode.bonesTexture ) {
                _updateBonesTexture(animNode, child.joints);
              }
            }
          }

          //
          if ( child.meshes ) {
            // draw
            let bonesTexture = child.bonesTexture;
            // let bonesTexture = null;

            child.meshes.forEach(id => {
              let gltfMesh = gltf.meshes[id];
              gltfMesh.primitives.forEach(gltfPrimitive => {
                let info = _primitive2drawinfo(
                  regl,
                  gltfPrimitive,
                  techniques,
                  textures,
                  bufferViews,
                  !!bonesTexture
                );
                info.uniforms.model = child.world;
                if ( bonesTexture ) {
                  info.uniforms.u_bonesTexture = bonesTexture;
                  info.uniforms.u_bonesTextureSize = bonesTexture.width;
                }

                let cmd = drawCommands[info.techID];
                cmd(info);
              });
            });
          }
        });

        // for ( let id in skins ) {
        //   debugDraw({texture: skins[id]});
        //   break;
        // }
      }

      // DISABLE: skeletons
      // for ( let id in joints ) {
      //   let joint = joints[id];
      //   if ( joint.parent ) {
      //     continue;
      //   }
      //   _walk(joint, (parent, child) => {
      //     drawCoord(child.world);
      //   });
      // }

      drawGrid();
    });

    input.reset();
  });
};

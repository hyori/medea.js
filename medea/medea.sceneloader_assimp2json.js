
/* medea - an Open Source, WebGL-based 3d engine for next-generation browser games.
 * (or alternatively, for clumsy and mostly useless tech demos written solely for fun)
 *
 * medea is (c) 2011, Alexander C. Gessler
 * licensed under the terms and conditions of the 3-clause BSD license.
 */

 // note: json2.js may be needed for contemporary browsers with incomplete HTML5 support
medea._addMod('sceneloader_assimp2json',['mesh','filesystem', typeof JSON === undefined ? 'json2.js' : null],function(undefined) {
	"use strict";
	var medea = this;


	var LoadMaterial = function(w,material_idx) {
		if (w.materials[material_idx]) {
			return w.materials[material_idx];
		}
		var inmaterial = w.scene.materials[material_idx].properties, props = {};

		// scan for some common material properties and pass them on to
		// the user-defined material resolver, whose task is to match
		// those standard properties to the application's material
		// framework.
		for(var i = 0; i < inmaterial.length; ++i) {
			var prop = inmaterial[i];

			if(prop.key === '$clr.diffuse') {
				props['diffuse'] = prop.value;
			}
			else if(prop.key === '$clr.specular') {
				props['specular'] = prop.value;
			}
			else if(prop.key === '$clr.diffuse') {
				props['diffuse'] = prop.value;
			}
			else if(prop.key === '$clr.emissive') {
				props['emissive'] = prop.value;
			}
			else if(prop.key === '$mat.shininess') {
				props['shininess'] = prop.value;
			}
			else if(prop.key === '$mat.shadingm') {
				props['shading_model'] = {
					3 : 'Phong',
					4 : 'Blinn',
					5 : 'Toon',
				}[prop.value] || 'Gouraud';
			}
			else if(prop.key === '$tex.file') {
				var n = {
					1 : 'diffuse',
					2 : 'specular',
					3 : 'ambient',
					4 : 'emissive',
					5 : 'height',
					6 : 'normal',
					7 : 'shininess',
					8 : 'opacity',
				}[prop.semantic];

				if(n) {
					props[n+'_texture'] = prop.value;

				}
			}
		}

		return w.materials[material_idx] = w.material_resolver(props);
	};

	var LoadMesh = function(w,mesh_idx) {
		if (w.meshes[mesh_idx]) {
			return w.meshes[mesh_idx];
		}
		var inmesh = w.scene.meshes[mesh_idx];

		// requirements: only one primitive type per mesh, no polygons
		// this should always be fullfilled for scenes produced by the original assimp2json tool.
		if(inmesh.primitivetypes !== 1 && inmesh.primitivetypes !== 2 && inmesh.primitivetypes !== 4) {
			throw "expect pure, triangulated meshes with only a single type of primitives";
		}

		var indices = new Array(inmesh.faces.length*inmesh.faces[0].length);
		for(var i = 0, n = 0; i < inmesh.faces.length; ++i) {
			var f = inmesh.faces[i];
			for(var j = 0; j < f.length; ++j, ++n) {
				indices[n] = f[j];
			}
		}

		// note: this modifies the input mesh, but copying would be too expensive
		// and would bring no extra value, after all we access each mesh only once.
		inmesh['positions'] = inmesh['vertices'];
		inmesh['uvs'] = inmesh['texturecoords'];

		// flip v component of UV coordinates
		if(inmesh['uvs']) {
			for(var i = 0; i < inmesh['uvs'].length; ++i) {
				var uv = inmesh['uvs'][i], c = inmesh['numuvcomponents'][i];
				for(var n = 0; n < uv.length/c; ++n) {
					uv[n*c+1] = 1.0-uv[n*c+1];
				}
			}
		}

		var outmesh = medea.CreateSimpleMesh(inmesh,indices,LoadMaterial(w,inmesh.materialindex));

		w.meshes[mesh_idx] = outmesh;
		return outmesh;
	};

	var LoadNode = function(w,anchor,node) {

		var outnd = anchor.AddChild(node.name);
		outnd.LocalTransform(mat4.transpose(mat4.create(node.transformation)));

		if(node.meshes) {
			for(var i = 0; i < node.meshes.length; ++i) {
				anchor.AddEntity(LoadMesh(w,node.meshes[i]));
			}
		}

		if(node.children) {
			for(var i = 0; i < node.children.length; ++i) {
				LoadNode(w,outnd,node.children[i]);
			}
		}
	};


	var LoadScene = function(scene,anchor,callback,material_resolver) {
		// batch the working set together in a dumpbin and pass it around to get rid of parameter hell
		var working = {
			callback : callback,
			scene : scene,
			material_resolver : material_resolver
		};

		working['meshes'] = new Array(scene.meshes.length);
		working['materials'] = new Array(scene.materials.length);

		LoadNode(working,anchor,scene.rootnode);

		callback();
	};


	medea._LoadScene_assimp2json = function(src,anchor,callback,material_resolver) {
		try {
			var scene = JSON.parse(src);
		}
		catch(e) {
			// #ifdef DEBUG
			medea.DebugAssert("Failed to read assimp2json scene from JSON, JSON.parse failed: " + e);
			// #endif
			return;
		}

		try {
			LoadScene(scene,anchor,callback,material_resolver);
		}
		catch(e) {
			// #ifdef DEBUG
			medea.DebugAssert("Failed to read assimp2json scene: " + e);
			// #endif
			return;
		}
	};
}, ['_LoadScene_assimp2json']);



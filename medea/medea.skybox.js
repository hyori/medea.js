
/* medea - an Open Source, WebGL-based 3d engine for next-generation browser games.
 * (or alternatively, for clumsy and mostly useless tech demos written solely for fun)
 *
 * medea is (c) 2011, Alexander C. Gessler
 * licensed under the terms and conditions of a 3 clause BSD license.
 */

medea._addMod('skybox',['material','standardmesh','cubetexture'],function(undefined) {
	"use strict";
	var medea = this;


	medea.CreateSkyboxNode = function(texbase) {
		var nd = medea.CreateNode("skybox");

		var mesh = medea.CreateStandardMesh_Cube(medea.CreateSimpleMaterialFromShaderPair('remote:mcore/shaders/skybox',{
			texture : medea.CreateCubeTexture( texbase )
		}));

		mesh.BB(medea.BB_INFINITE);

		medea._initMod('renderqueue');
		mesh.RenderQueue(medea.RENDERQUEUE_BACKGROUND);
		mesh.Material().Passes().forEach( function(p) {
			p.State({
			'depth_test'  : true,
			'depth_write' : false,
			'cull_face' : true,
			'cull_face_mode' : 'front'
			});
		});

		nd.AddEntity(mesh);
		return nd;
	};
});

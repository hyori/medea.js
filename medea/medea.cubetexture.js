
/* medea - an Open Source, WebGL-based 3d engine for next-generation browser games.
 * (or alternatively, for clumsy and mostly useless tech demos written solely for fun)
 *
 * medea is (c) 2011, Alexander C. Gessler
 * licensed under the terms and conditions of a 3 clause BSD license.
 */

medea._addMod('cubetexture',['filesystem'],function(undefined) {
	"use strict";
	var medea = this, gl = medea.gl;

	var CUBE = medea.TEXTURE_TYPE_CUBE = gl.TEXTURE_CUBE_MAP;

	var default_names = [
		'posx','negx','posy','negy','posz','negz'
	];

	medea._initMod('filesystem');
	medea.CubeTexture = medea.Resource.extend( {

		init : function(src, callback, flags) {

			this.flags = flags || 0;
			this.texture = gl.createTexture();
			this.callback = callback;

			// sentinel size as long as we don't know the real value yet
			this.width = this.glwidth = this.height = this.glheight = -1;

			this.img = new Array(6);

			if (!Array.isArray(src)) {
				// preserve the file extension and append the postfixes with '_'
				var s = src.split('.'), ext = s.length > 1 ? '.'+s[s.length-1] : '.jpg';
				if(s[0].length && s[0][s[0].length-1] != '/') {
					s[0] += '_';
				}
				src = new Array(6);
				for(var i = 0; i < 6; ++i) {
					src[i] = s[0] + default_names[i] + ext;
				}
			}

			var outer = this;
			this.counter = 6;
			this.src = src;

			for(var i = 0; i < 6; ++i) {
				(function(i) {
				outer.img[i] = new Image();
				outer.img[i].onload = function() {
					outer.OnDelayedInit(i);
				};
				outer.img[i].src = medea.FixURL(src[i]);
				}(i));
			}
		},

		OnDelayedInit : function(index) {

			var w = this.img[index].width, h = this.img[index].height;

			// cube textures must be POTs and all faces must be squares. Anything else
			// doesn't make sense unlike for 2D textures.
			// #ifdef DEBUG
			medea.DebugAssert(w === h && medea._IsPow2(w) && medea._IsPow2(h),'cube texture faces must be squared and POTs');
			medea.DebugAssert(this.counter === 6 || (w === this.width && h === this.height),'cube texture faces must be all of the same size');
			// #endif

			this.width = this.glwidth = w;
			this.height = this.glheight = h;

			// mark this resource as complete if this was the last face
			if (--this.counter === 0) {
				this._super();

				if (!(this.flags & medea.TEXTURE_FLAG_LAZY_UPLOAD)) {
					this._Upload();
				}

				medea.LogDebug("successfully loaded cube texture " + this.GetSource());
			}
		},

		GetWidth : function() {
			return this.width;
		},

		GetHeight : function() {
			return this.height;
		},

		GetGlWidth : function() {
			return this.glwidth;
		},

		GetGlHeight : function() {
			return this.glheight;
		},

		GetGlTexture : function() {
			return this.texture;
		},

		GetSource : function() {
			return this.src[0] + '...(1-6)';
		},

		IsPowerOfTwo : function() {
			return true;
		},

		IsSquared : function() {
			return true;
		},

		_Upload : function() {
			if (this.uploaded) {
				return;
			}

			var old = gl.getParameter(gl.TEXTURE_BINDING_CUBE);
			if(old !== this.texture) {
				gl.bindTexture(CUBE, this.texture);
			}

			// fill all faces
			for ( var i = 0; i < 6; ++i) {
				var face = gl.TEXTURE_CUBE_MAP_POSITIVE_X + i;
				gl.texImage2D(face, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.img[i]);
			}

			// setup sampler states and generate MIPs
			gl.texParameteri(CUBE, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

			if (!(this.flags & medea.TEXTURE_FLAG_NO_MIPS)) {
				gl.texParameteri(CUBE, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
				gl.generateMipmap(CUBE);
			}
			else {
				gl.texParameteri(CUBE, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			}

			// because _Upload may be called at virtually any time, we
			// need to ensure that the global state is not altered.
			if(old !== this.texture) {
				gl.bindTexture(CUBE, old);
			}

			// this hopefully frees some memory
			if (!(this.flags & medea.TEXTURE_FLAG_KEEP_IMAGE)) {
				this.img = null;
			}

			this.uploaded = true;
		},

		_Bind : function(slot) {
			if (!this.IsComplete()) {
				return;
			}

			slot = slot || 0;

			gl.activeTexture(gl.TEXTURE0 + slot);
			gl.bindTexture(CUBE,this.texture);

			if (!this.uploaded) {
				this._Upload();
			}

			return slot;
		},
	});

	medea.CreateCubeTexture = function(res, callback) {
		return new medea.CubeTexture(res, callback);
	}
});


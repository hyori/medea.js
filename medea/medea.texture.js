
/* medea - an Open Source, WebGL-based 3d engine for next-generation browser games.
 * (or alternatively, for clumsy and mostly useless tech demos written solely for fun)
 *
 * medea is (c) 2011, Alexander C. Gessler
 * licensed under the terms and conditions of a 3 clause BSD license.
 */

medea._addMod('texture',['image','filesystem'],function(undefined) {
	"use strict";
	var medea = this, gl = medea.gl;

	medea._initMod('filesystem');
	medea._initMod('image');



	var TEX = medea.TEXTURE_TYPE_2D = gl.TEXTURE_2D;

	// flags specific to medea.Texture
	medea.TEXTURE_FLAG_KEEP_IMAGE    = medea.IMAGE_FLAG_USER;
	medea.TEXTURE_FLAG_LAZY_UPLOAD   = medea.IMAGE_FLAG_USER << 1;
	medea.TEXTURE_FLAG_NPOT_PAD      = medea.IMAGE_FLAG_USER << 2;
	medea.TEXTURE_FLAG_NO_MIPS       = medea.IMAGE_FLAG_USER << 3;

	// possible values for the `format` parameter
	medea.TEXTURE_FORMAT_RGBA        = 'rgba';
	medea.TEXTURE_FORMAT_RGB         = 'rgb';
	medea.TEXTURE_FORMAT_LUM         = 'lum';
	medea.TEXTURE_FORMAT_LUM_ALPHA   = 'luma';


	var texfmt_to_gl = function(f) {
		switch(f) {
			case medea.TEXTURE_FORMAT_RGBA:
				return gl.RGBA;
			case medea.TEXTURE_FORMAT_RGB:
				return gl.RGB;
			case medea.TEXTURE_FORMAT_LUM:
				return gl.LUMINANCE;
			case medea.TEXTURE_FORMAT_LUM_ALPHA:
				return gl.LUMINANCE_ALPHA;
		}
		// #ifdef DEBUG
		medea.DebugAssert('unrecognized texture format: ' + f);
		// #endif
	}

	medea.MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);

	medea.Texture = medea.Image.extend( {

		init : function(src_or_img, callback, flags, format, force_width, force_height) {
			this.texture = gl.createTexture();
			this.glwidth = force_width || -1;
			this.glheight = force_height || -1;
			this.format = format || medea.TEXTURE_FORMAT_RGBA;

			this._super(src_or_img, callback, flags);
		},

		OnDelayedInit : function() {
			// mark this resource as complete
			this._super();

			if (this.IsPowerOfTwo()) {
				if (this.glwidth === -1) {
					this.glwidth = this.width;
				}
				if (this.glheight === -1) {
					this.glheight = this.height;
				}
			}
			else {
				if (this.glwidth === -1) {
					this.glwidth = medea._NextPow2(this.width);
				}
				if (this.glheight === -1) {
					this.glheight = medea._NextPow2(this.height);
				}
			}

			if (this.glwidth > medea.MAX_TEXTURE_SIZE || this.glheight > medea.MAX_TEXTURE_SIZE) {
				this.glwidth = Math.min(this.glwidth, medea.MAX_TEXTURE_SIZE);
				this.glheight = Math.min(this.glheight, medea.MAX_TEXTURE_SIZE);

				// #ifdef LOG

				// normally we should warn about this immediately, but in some cases
				// textures are created but never uploaded to the GPU (i.e. the
				// terrain code does this intentionally to be able to switch from
				// GPU to CPU terrain generation without recreating all heightmaps.
				this.hits_size_limit = true;

				// #endif
			}

			if (!(this.flags & medea.TEXTURE_FLAG_LAZY_UPLOAD)) {
				this._Upload();
			}

			medea.LogDebug("successfully loaded texture " + this.GetSource());
		},

		GetGlTextureWidth : function() {
			return this.glwidth;
		},

		GetGlTextureHeight : function() {
			return this.glheight;
		},

		GetPaddingCompensationFactor : function() {
			return [this.width / this.glwidth, this.height / this.glheight];
		},

		GetGlTexture : function() {
			return this.texture;
		},

		_Upload : function() {
			if (this.uploaded) {
				return;
			}

			var old = gl.getParameter(gl.TEXTURE_BINDING_2D);
			if(old !== this.texture) {
				gl.bindTexture(TEX, this.texture);
			}

			var img = this.img;
			var intfmt = texfmt_to_gl(this.format);

			// scale or pad NPOT or oversized textures
			if (this.glwidth !== this.width || this.glheight !== this.height) {
				// #ifdef LOG
				var newsize = '(' + this.glwidth + ' x ' + this.glheight + ')';
				if (!this.IsPowerOfTwo()) {
					medea.Log('texture ' + this.GetSource() + ' is not of a power-of-two size, this means it will be ' + (
						this.flags & medea.TEXTURE_FLAG_NPOT_PAD ? 'padded' : 'scaled') + ' to ' + newsize,'warn');
				}

				if (this.hits_size_limit) {
					medea.Log('texture ' + this.GetSource() + ' is exceeds the maximum size so it will be ' + (
						this.flags & medea.TEXTURE_FLAG_NPOT_PAD ? 'padded' : 'scaled') + ' to '  + newsize,'warn');
				}
				// #endif

				// http://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences#Non-Power_of_Two_Texture_Support
				var canvas = document.createElement("canvas");
				canvas.width = this.glwidth;
				canvas.height = this.glheight;
				var ctx = canvas.getContext("2d");

				if (this.flags & medea.TEXTURE_FLAG_NPOT_PAD) {
					ctx.drawImage(img, 0, 0, Math.min(img.width,canvas.width),
						Math.min(img.height,canvas.height));
				}
				else {
					ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				}

				// according to http://jsperf.com/texture-sources this should be fastest,
				// but it also consumes loads of memory and quickly screws up Webkit and
				// Gecko. `texImage2D(TEX,0,canvas)` keeps throwing type errors in both
				// engines, though.
				var c = ctx.getImageData(0,0,canvas.width,canvas.height);
				ctx = canvas = null;
				gl.texImage2D(TEX, 0, intfmt, intfmt, gl.UNSIGNED_BYTE, c);
			}
			else {

				// copy to the gl texture
				gl.texImage2D(TEX, 0, intfmt, intfmt, gl.UNSIGNED_BYTE, img);
			}

			// setup sampler states and generate MIPs
			gl.texParameteri(TEX, gl.TEXTURE_WRAP_S, gl.REPEAT);
			gl.texParameteri(TEX, gl.TEXTURE_WRAP_T, gl.REPEAT);
			gl.texParameteri(TEX, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

			if (!(this.flags & medea.TEXTURE_FLAG_NO_MIPS)) {
				gl.texParameteri(TEX, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
				gl.generateMipmap(TEX);
			}
			else {
				gl.texParameteri(TEX, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			}

			// because _Upload may be called at virtually any time, we
			// need to ensure that the global state is not altered.
			if(old !== this.texture) {
				gl.bindTexture(TEX, old);
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
			gl.bindTexture(TEX,this.texture);

			if (!this.uploaded) {
				this._Upload();
			}
			return slot;
		},
	});

	medea.CreateTexture = function(src_or_image, callback, flags, format, force_width, force_height) {
		return new medea.Texture(src_or_image, callback, flags, format, force_width, force_height);
	}
});



/* medea - an Open Source, WebGL-based 3d engine for next-generation browser games.
 * (or alternatively, for clumsy and mostly useless tech demos written solely for fun)
 *
 * medea is (c) 2011, Alexander C. Gessler
 * licensed under the terms and conditions of a 3 clause BSD license.
 */

medea._addMod('material',['shader','texture'],function(undefined) {
	"use strict";
	var medea = this, gl = medea.gl;


	medea.MATERIAL_CLONE_COPY_STATE 		= 0x1;
	medea.MATERIAL_CLONE_SHARE_STATE 		= 0x2;

	medea.MATERIAL_CLONE_COPY_CONSTANTS 	= 0x4;
	medea.MATERIAL_CLONE_SHARE_CONSTANTS 	= 0x8;


	// map from GLSL type identifiers to the corresponding GL enumerated types
	var glsl_typemap = {
		'vec2'	: gl.FLOAT_VEC2,
		'vec3'	: gl.FLOAT_VEC3,
		'vec4'	: gl.FLOAT_VEC4,
		'ivec2'	: gl.INT_VEC2,
		'ivec3'	: gl.INT_VEC3,
		'ivec4'	: gl.INT_VEC4,
		'bvec2'	: gl.BOOL_VEC2,
		'bvec3'	: gl.BOOL_VEC2,
		'bvec4'	: gl.BOOL_VEC4,
		'mat2'	: gl.BOOL_MAT2,
		'mat3'	: gl.BOOL_MAT3,
		'mat4'	: gl.BOOL_MAT4,
		'sampler2D'	: gl.SAMPLER_2D,
		'samplerCube'	: gl.SAMPLER_CUBE,
	};

	var glsl_type_picker = [];
	for (var k in glsl_typemap) {
		glsl_type_picker.push(k);
	}
	glsl_type_picker = '(' + glsl_type_picker.join('|') + ')';


	medea.ShaderSetters = {
		"CAM_POS" :  function(prog, pos, state) {
			gl.uniform3fv(pos, state.GetQuick("CAM_POS"));
		},

		"CAM_POS_LOCAL" :  function(prog, pos, state) {
			gl.uniform3fv(pos, state.Get("CAM_POS_LOCAL"));
		},

		"WVP" :  function(prog, pos, state) {
			gl.uniformMatrix4fv(pos, false, state.Get("WVP"));
		},

		"WIT" :  function(prog, pos, state) {
			gl.uniformMatrix4fv(pos, false, state.Get("WIT"));
		},

		"WI" :  function(prog, pos, state) {
			gl.uniformMatrix4fv(pos, false, state.Get("WI"));
		},

		"VP" :  function(prog, pos, state) {
			gl.uniformMatrix4fv(pos, false, state.Get("VP"));
		},

		"W" :  function(prog, pos, state) {
			gl.uniformMatrix4fv(pos, false, state.GetQuick("W"));
		},

		"V" :  function(prog, pos, state) {
			gl.uniformMatrix4fv(pos, false, state.GetQuick("V"));
		},

		"P" :  function(prog, pos, state) {
			gl.uniformMatrix4fv(pos, false, state.GetQuick("P"));
		},
	};


	// class Pass
	medea.Pass = medea.Class.extend({


		init : function(vs,ps,constants,attr_map,state) {
			this.vs = vs;
			this.ps = ps;
			this.constants = constants || {};
			this.auto_setters = {};
			this.attr_map = attr_map;
			this.state = state || {};
			this.program = null;

// #ifdef DEBUG
			if (!vs || !ps) {
				medea.DebugAssert("need valid vertex and pixel shader");
			}
// #endif

			this._TryAssembleProgram();
		},


		Begin : function(statepool) {
			if (this.program === null) {
				this._TryAssembleProgram();
				if(!this.IsComplete()) {
					return false;
				}
			}

			gl.useProgram(this.program);
			this._SetAutoState(statepool);

			return true;
		},

		End : function() {
		},

		GetAttributeMap : function() {
			return this.attr_map;
		},

		State : function(state) {
			if (state === undefined) {
				return this.state;
			}
			this.state = state;
		},


		// some shortcuts to simplify common state handling
		CullFace : function(c) {
			if (c === undefined) {
				return this.state.cull_face;
			}

			this.state.cull_face = c;
		},

		CullFaceMode : function(c) {
			if (c === undefined) {
				return this.state.cull_face_mode;
			}

			this.state.cull_face_mode = c;
		},

		DepthWrite : function(c) {
			if (c === undefined) {
				return this.state.depth_write;
			}

			this.state.depth_write = c;
		},

		DepthTest : function(c) {
			if (c === undefined) {
				return this.state.depth_test;
			}

			this.state.depth_test = c;
		},

		DepthFunc : function(c) {
			if (c === undefined) {
				return this.state.depth_func;
			}

			this.state.depth_func = c;
		},



		Set : function(k,val) {
			if (val === undefined) {
				return;
			}

			var c = this.constants;
			c[k] = val;

			if (this.program === null) {
				// do the real work later when we have the actual program
				return;
			}

			var pos = gl.getUniformLocation(this.program, k);
			if (!pos) {
				// #ifdef DEBUG
				medea.DebugAssert("uniform variable location not found: " + k);
				// #endif
				return;
			}

			var handler = null;
			var type = this._GetUniformType(k);

			switch(type) {
				case gl.FLOAT_VEC4:
					handler = function(prog, pos, state, curval) {
						gl.uniform4fv(pos, curval );
					};
					break;
				case gl.FLOAT_VEC3:
					handler = function(prog, pos, state, curval) {
						gl.uniform3fv(pos, curval );
					};
					break;
				case gl.FLOAT_VEC2:
					handler = function(prog, pos, state, curval) {
						gl.uniform2fv(pos, curval );
					};
					break;

				case gl.INT_VEC4:
				case gl.BOOL_VEC4:
					handler = function(prog, pos, state, curval) {
						gl.uniform4iv(pos, curval );
					};
					break;
				case gl.INT_VEC3:
				case gl.BOOL_VEC3:
					handler = function(prog, pos, state, curval) {
						gl.uniform3iv(pos, curval );
					};
					break;
				case gl.INT_VEC2:
				case gl.BOOL_VEC2:
					handler = function(prog, pos, state, curval) {
						gl.uniform2iv(pos, curval );
					};
					break;

				case gl.FLOAT_MAT4:
					handler = function(prog, pos, state,curval) {
						gl.uniformMatrix4fv(pos, false, curval);
					};
					break;

				case gl.FLOAT_MAT3:
					handler = function(prog, pos, state,curval) {
						gl.uniformMatrix3fv(pos, false, curval);
					};
					break;

				case gl.FLOAT_MAT2:
					handler = function(prog, pos, state,curval) {
						gl.uniformMatrix2fv(pos, false, curval);
					};
					break;

				case gl.SAMPLER_2D:
				case gl.SAMPLER_CUBE:

					// explicitly bound texture
					handler = function(prog, pos, state, curval) {
						if (!(curval instanceof medea.Resource)) {
							//curval = medea.GetDefaultTexture();
							return;
						}

						state = state.GetQuick('_gl');
						state.texage = state.texage || 0;

						// check if this texture is already active, if not get rid of the
						// oldest texture in the sampler cache.
						var slots = state.tex_slots || new Array(6), oldest = state.texage+1, oldesti = 0, curgl = curval.GetGlTexture();

						for(var i = 0; i < slots.length; ++i) {
							if (!slots[i]) {
								oldest = state.texage+2;
								oldesti = i;
							}
							else if (slots[i][1] === curgl) {
								slots[i][0] = state.texage++;

								// XXX why do we need _Bind() here? Setting the index should suffice
								// since the texture is already set.
								gl.uniform1i(pos, curval._Bind(i));
								return;
							}
							else if ( slots[i][0] < oldest && oldest !== state.texage+2) {
								oldest = slots[i][0];
								oldesti = i;
							}
						}

						slots[oldesti] = [state.texage++,curgl];
						gl.uniform1i(pos, curval._Bind(oldesti));

						state.tex_slots = slots;
					};

					if (typeof val === 'string') {
						// #ifdef DEBUG
						medea.LogDebug('create texture for shader uniform with string value: ' + k + ', ' + val);
						// #endif
						medea.FetchMods(['texture'], function() {
							c[k] = medea.CreateTexture(val);
						});

					}
					else if (typeof val === 'object' && val.low) {
						// #ifdef DEBUG
						medea.LogDebug('create lod texture for shader uniform with string value: ' + k + ', ' + val);
						// #endif
						medea.FetchMods(['lodtexture'], function() {
							c[k] = medea.CreateLODTexture(val);
						});
					}
					break;

				default:
					// #ifdef DEBUG
					medea.DebugAssert('constant type not recognized, ignoring: ' + k);
					// #endif
			}

			if(handler) {
				this.auto_setters[k] = [pos,function(prog,pos,state) {
					var value = c[k];

					if (typeof value === 'string') {
						try {
							value = eval(value);
						} catch (e) {
							// #ifdef DEBUG
							medea.DebugAssert('eval()ing constant failed: ' + e + ' name: ' + k + ', type: ' + type);
							// #endif
						}
					}

					handler(prog,pos,state,value);
				}];
			}
		},

		Get : function(k) {
			return this.constants[k];
		},

		IsComplete : function() {
			return this.program !== null;
		},

		IsClone : function() {
			return 'clone_flags' in this;
		},


		_Clone : function(clone_flags, out) {
			var new_out = false;
			if(!out) {
				out = new medea.Pass(this.vs, this.ps);
				new_out = true;
			}

			if (new_out) {
				if (clone_flags & medea.MATERIAL_CLONE_COPY_STATE) {
					out.state = medea.Merge(this.state, {}, {});
				}
				else if (clone_flags & medea.MATERIAL_CLONE_SHARE_STATE) {
					out.state = this.state;
				}

				if (clone_flags & medea.MATERIAL_CLONE_COPY_CONSTANTS) {
					out.constants = medea.Merge(this.constants, {}, {});
				}
				else if (clone_flags & medea.MATERIAL_CLONE_SHARE_CONSTANTS) {
					out.constants = this.constants;
				}
			}

			if (!this.IsComplete()) {
				// since this instance isn't complete yet, we can't
				// clone the other yet. Add it to a list and do the actual cloning
				// as soon as all data is present. This is a bit dirty and imposes an
				// unwanted reference holder on the cloned pass, but it cannot be
				// avoided with the current design.
				if (!this.wannabe_clones) {
					this.wannabe_clones = [];
				}
				this.wannabe_clones.push(out);
				out.clone_flags = clone_flags;
				return out;
			}

			// program reference can be shared (XXX but this does not play well
			// with explicit disposal semantics).
			out.program = this.program;

			// attribute mapping is always safe to share
			out.attr_map = this.attr_map;

			// however, we need to rebuild setters from scratch
			out.auto_setters = {};
			out._ExtractUniforms();
			out._RefreshState();

			return out;
		},

		_ExtractUniforms : function() {
			// extract uniforms that we update automatically and setup state managers for them
			for(var k in medea.ShaderSetters) {
				var pos = gl.getUniformLocation(this.program, k);
				if(pos) {
					this.auto_setters[k] = [pos,medea.ShaderSetters[k]];
				}
			};
		},

		_RefreshState : function() {
			// re-install state managers for all constants
			var old = this.constants;
			this.constants = {};
			for(var k in old) {
				this.Set(k,old[k]);
			}
		},

		_TryAssembleProgram : function() {
			if (this.IsComplete() || !this.vs.IsComplete() || !this.ps.IsComplete() || this.IsClone()) {
				// can't assemble this program yet, for we first need to wait for some dependent resources to load
				return;
			}
			var p = this.program = gl.createProgram();

			gl.attachShader(p,this.vs.GetGlShader());
			gl.attachShader(p,this.ps.GetGlShader());


			gl.linkProgram(p);
			if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
				medea.NotifyFatal("failure linking program, error log: " + gl.getProgramInfoLog(p));
				return;
			}

			// #ifdef DEBUG
			gl.validateProgram(p);
			if (!gl.getProgramParameter(p, gl.VALIDATE_STATUS)) {
				medea.NotifyFatal("failure validating program, error log: " + gl.getProgramInfoLog(p));
				return;
			}
			// #endif

			this._ExtractUniforms();
			this._RefreshState();

			// if the user didn't supply an attribute mapping (i.e. which pre-defined
			// attribute type maps to which attribute in the shader), derive it
			// from the attribute names, assuming their names are recognized.
			if(!this.attr_map) {
				var a = this.attr_map = {};
				for(var i = 0, n; n = gl.getActiveAttrib(p,i); ++i) {
					a[n.name] = i;
				}

				// #ifdef DEBUG
				if(a['POSITION'] === undefined) {
					medea.LogDebug('failed to derive automatic attribute mapping table, '
						+'at least there is no POSITION input defined.');
				}
				// #endif
			}

			// now transfer the dictionaries and the program reference to all pending
			// clones for this material.
			if (this.wannabe_clones) {
				for (var i = 0; i < this.wannabe_clones.length; ++i) {
					this._Clone( this.wannabe_clones[i].clone_flags, this.wannabe_clones[i] );
				}

				delete this.wannabe_clones;
			}
		},

		_SetAutoState : function(statepool) {

			// update shader variables automatically
			for(var k in this.auto_setters) {
				var v = this.auto_setters[k];
				v[1](this.program,v[0],statepool);
			}

			// and apply global state blocks
			if (this.state) {
				medea.SetState(this.state,statepool);
			}
		},

		_GetUniformType : function(name) {
			/* Using getActiveUniform to obtain the type seems to be the most
			   straightforward way, but unfortunately it keeps telling me
			   that a lot of uniforms are in fact sampler2D's even if they
			   are not. Also, results seem to vary from system to system,
			   suggesting trouble with either the underlying GL implementation
			   or the browser's WebGL code

			   So for now, until all such issues are resolved in all major
			   browsers, scan the source code for the declaration of the
			   variable and extract the type.

			   This will fail for arrays, structures, etc. but those are not
			   currently handled anyway.
			*/

			var vs = this.vs.GetPreProcessedSourceCode(), ps = this.ps.GetPreProcessedSourceCode();
			var rex = new RegExp(glsl_type_picker + '\\s+' + name);

			// further escaping should not be needed, name is required to be
			// a valid GLSL identifier.
			try {
				var typename = (rex.exec(vs) || rex.exec(ps))[1];
			} catch(e) {
				// should not happen
				medea.DebugAssert('could not find type declaration for uniform: ' + name);
			}

			// #ifdef DEBUG
			medea.DebugAssert(!!typename,"failed to determine data type of shader uniform " + name);
			// #endif

			return glsl_typemap[typename];

			/*
			var info = gl.getActiveUniform(this.program,pos), type = info.type;

			// this is a workaround for my secondary linux system on which the driver
			// for the builtin Intel GMA unit is not only not on the whitelist of ff/chrome,
			// but also keeps confusing sampler and matrix uniforms. The workaround
			// doesn't make it much betteŗ, though, because the driver manages to get
			// almost everything else wrong as well. Seems there is a reason that
			// whitelists are used to determine if Webgl is to be supported or not.
			// XXX SAME trouble on a GF 9600M. Hmpf.
			if (typeof val === 'string' && /.*\.(jpg|png|gif|bmp)/i.test(val) ) {
				type = gl.SAMPLER_2D;
			}
			*/
		}
	});

	// class Material
	medea.Material = medea.Class.extend({
		name : "",

		init : function(passes, name) {
			if(name) {
				this.name = name;
			}

			this.passes = passes;
			if (this.passes instanceof medea.Pass) {
				this.passes = [this.passes];
			}
// #ifdef DEBUG
			if (!this.passes) {
				medea.DebugAssert("need at least one pass for a material to be complete");
			}
// #endif
		},

		Pass : function(n,p) {
			if(p === undefined) {
				return this.passes[n];
			}
			if (n == this.passes.length) {
				this.passes.push(p);
				return;
			}
			// #ifdef DEBUG
			else if (n > this.passes.length) {
				medea.DebugAssert('pass index out of range, cannot add pass if there is no pass that preceedes it: ' + n);
				return;
			}
			// #endif
			this.passes[n] = p;
		},

		Passes : function(p) {
			if (p === undefined) {
				return this.passes;
			}
			this.passes = p;
		},

		GetId: function() {
			return 0;
		},

		Name : medea._GetSet(this,'name'),

		Use: function(drawfunc,statepool) {
			// invoke the drawing callback once per pass
			this.passes.forEach(function(pass) {

				if(!pass.Begin(statepool)) {
					// XXX substitute a default material?
					return;
				}

				drawfunc(pass);
				pass.End();
			});
		},
	});

	medea.CreateSimpleMaterialFromColor = function(color, dummy_light) {
		if(color.length === 3) { 
			color = [color[0],color[1],color[2],1.0];
		}
		var name = "remote:mcore/shaders/simple-color", constants = {
			color:color
		};

		if(dummy_light) {
			constants['lightdir'] = [0.309,1.209,-0.709];
			name += '-lit';
		}
		return new medea.Material(medea.CreatePassFromShaderPair(name,constants));
	};
	
	
	medea.CreateSimpleMaterialFromVertexColor = function(dummy_light) {
		var name = "remote:mcore/shaders/simple-vertex-color", constants = {
			
		};

		if(dummy_light) {
			constants['lightdir'] = [0.709,-0.709,0.709];
			name += '-lit';
		}
		return new medea.Material(medea.CreatePassFromShaderPair(name,constants));
	};
	

	medea.CreateSimpleMaterialFromTexture = function(texture, dummy_light) {
		var name = "remote:mcore/shaders/simple-textured", constants = {
			texture:texture
		};

		if(dummy_light) {
			constants['lightdir'] = [0.709,-0.709,0.709];
			name += '-lit';
		}

		return new medea.Material(medea.CreatePassFromShaderPair(name,constants));
	};
	

	medea.CreateMaterial = function(passes, name) {
		return new medea.Material(passes, name);
	};

	medea.CloneMaterial = function(mat, name, clone_flags) {
		var passes = mat.Passes(), newp = new Array(passes.length);
		for (var i = 0; i < passes.length; ++i) {
			newp[i] = medea.ClonePass(passes[i], clone_flags);
		}
		return new medea.Material(newp, name || mat.Name()+'_clone');
	};

	medea.CreateSimpleMaterialFromShaderPair = function(name, constants, attr_map, defines) {
		return new medea.Material(medea.CreatePassFromShaderPair(name,constants, attr_map, defines));
	};

	medea.CreatePassFromShaderPair = function(name, constants, attr_map, defines) {
		return new medea.Pass( medea.CreateShader(name+'.vs', defines), medea.CreateShader(name+'.ps', defines), constants, attr_map );
	};

	medea.ClonePass = function(pass, clone_flags) {
		return pass._Clone(clone_flags);
	};
});






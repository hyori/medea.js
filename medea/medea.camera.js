

medea.stubs["Camera"] = (function() {
	var medea = this;
	
	medea._Require("Entity");
	
	medea._CAMERA_DIRTY_VIEW = 0x1;
	medea._CAMERA_DIRTY_PROJ = 0x2;

	// class Camera
	medea.Camera = medea.Entity.extend(
	{
		init : function(name,fovy,aspect,znear,zfar,viewport) {	
			this._super(name);
			
			this.view = M4x4.clone(M4x4.I);
			this.proj = M4x4.clone(M4x4.I);
			
			this.fovy = fovy || 90;
			this.aspect = aspect;
			this.znear = znear || 0.1;
			this.zfar = zfar || 1000;
			
			this.viewport = null;
			if (viewport) {
				viewport.SetCamera(this);
			}
		},
		
	
		Render : function(viewport,rqmanager) {
			// we don't need any rendering logic for cameras, as rendering is implicitly triggered
			// through the viewport the camera is assigned to.
		},
		
		Update : function(dtime) {
			// transformation matrix updates are performed lazily as needed so this is empty, too.
		},
		
		
		
		GetViewMatrix : function() {
			this._UpdateViewMatrix();
			return this.view;
		},
		
		GetProjectionMatrix : function() {
			this._UpdateProjectionMatrix();
			return this.view;
		},
		
		OnSetParent : function(parent) {
			this._super(parent);
			this.flags |= medea._CAMERA_DIRTY_VIEW;
		},
		
		OnSetViewport : function(vp) {
			this.viewport = vp;
		},
		
		
		
		GetZNear : function() {
			return this.znear;
		},
		
		GetZFar : function() {
			return this.zfar;
		},
		
		GetAspect : function() {
			return this.aspect;
		},
		
		GetFOV : function() {
			return this.fovy;
		},
		
		
		SetZNear : function(v) {
			this.znear = v;
		},
		
		SetZFar : function(v) {
			this.zfar = v;
		},
		
		// aspect may be set to null to have the camera implementation take it from the viewport
		SetAspect : function(v) {
			this.aspect = v;
		},
		
		SetFOV : function(v) {
			this.fovy = v;
		},
		
		
		_UpdateViewMatrix : function() {
			if (!(this.flags & medea._CAMERA_DIRTY_VIEW)) {
				return this.view;
			}
			
			this.flags &= ~medea._CAMERA_DIRTY_VIEW;
			return this.view;
		},
		
		_UpdateProjectionMatrix : function() {
			if (!(this.flags & medea._CAMERA_DIRTY_PROJ)) {
				return this.proj;
			}
			
			var aspect = this.aspect;
			if (aspect === null) {
// #ifdef DEBUG
				if (!this.viewport) {
					medea.DebugAssert("aspect may only be omitted if the camera is assigned to a viewport");
				}
// #endif
				aspect = this.viewport.GetAspect();
			}
			M4x4.makePerspective(this.fovy,aspect,this.znear,this.zfar,this.proj);
			
			this.flags &= ~medea._CAMERA_DIRTY_PROJ;
			return this.proj;
		},
	});
	
	medea.stubs["Camera"] = null;
});



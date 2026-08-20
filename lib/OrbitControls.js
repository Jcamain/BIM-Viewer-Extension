/**
 * OrbitControls — AMD wrapper for Qlik Sense extension use
 * Based on Three.js r128 OrbitControls (MIT licence)
 * Wrapped in define() for RequireJS compatibility
 */
define(["./three.min"], function (THREE) {
  "use strict";

  var OrbitControls = function (object, domElement) {
    this.object     = object;
    this.domElement = domElement || document;
    this.enabled    = true;
    this.target     = new THREE.Vector3();

    this.minDistance    = 0;
    this.maxDistance    = Infinity;
    this.minPolarAngle  = 0;
    this.maxPolarAngle  = Math.PI;
    this.enableDamping  = false;
    this.dampingFactor  = 0.05;
    this.enableZoom     = true;
    this.zoomSpeed      = 1.0;
    this.enableRotate   = true;
    this.rotateSpeed    = 1.0;
    this.enablePan      = true;
    this.panSpeed       = 1.0;
    this.screenSpacePanning = true;
    this.autoRotate     = false;
    this.autoRotateSpeed= 2.0;

    var STATE = { NONE: -1, ROTATE: 0, DOLLY: 1, PAN: 2 };
    var state = STATE.NONE;
    var EPS   = 1e-6;

    var spherical      = new THREE.Spherical();
    var sphericalDelta = new THREE.Spherical();
    var scale          = 1;
    var panOffset      = new THREE.Vector3();

    var rotateStart = new THREE.Vector2();
    var rotateEnd   = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();
    var panStart    = new THREE.Vector2();
    var panEnd      = new THREE.Vector2();
    var panDelta    = new THREE.Vector2();
    var dollyStart  = new THREE.Vector2();
    var dollyEnd    = new THREE.Vector2();
    var dollyDelta  = new THREE.Vector2();

    var scope = this;

    function getZoomScale() { return Math.pow(0.95, scope.zoomSpeed); }

    function rotateLeft(a)  { sphericalDelta.theta -= a; }
    function rotateUp(a)    { sphericalDelta.phi   -= a; }

    var panLeft = (function () {
      var v = new THREE.Vector3();
      return function (dist, mtx) {
        v.setFromMatrixColumn(mtx, 0).multiplyScalar(-dist);
        panOffset.add(v);
      };
    }());

    var panUp = (function () {
      var v = new THREE.Vector3();
      return function (dist, mtx) {
        if (scope.screenSpacePanning) v.setFromMatrixColumn(mtx, 1);
        else { v.setFromMatrixColumn(mtx, 0); v.crossVectors(scope.object.up, v); }
        v.multiplyScalar(dist);
        panOffset.add(v);
      };
    }());

    var doPan = (function () {
      var offset = new THREE.Vector3();
      return function (dx, dy) {
        var el = scope.domElement;
        if (scope.object.isPerspectiveCamera) {
          var pos  = scope.object.position;
          offset.copy(pos).sub(scope.target);
          var td   = offset.length() * Math.tan((scope.object.fov / 2) * Math.PI / 180);
          panLeft(2 * dx * td / el.clientHeight, scope.object.matrix);
          panUp(2   * dy * td / el.clientHeight, scope.object.matrix);
        }
      };
    }());

    function dollyOut(s) { scale /= s; }
    function dollyIn(s)  { scale *= s; }

    /* Mouse handlers */
    function onMouseDown(e) {
      if (!scope.enabled) return;
      e.preventDefault();
      switch (e.button) {
        case 0:
          if (e.shiftKey) { panStart.set(e.clientX, e.clientY);    state = STATE.PAN; }
          else            { rotateStart.set(e.clientX, e.clientY); state = STATE.ROTATE; }
          break;
        case 1: dollyStart.set(e.clientX, e.clientY); state = STATE.DOLLY; break;
        case 2: panStart.set(e.clientX, e.clientY);   state = STATE.PAN;   break;
      }
      if (state !== STATE.NONE) {
        document.addEventListener("mousemove", onMouseMove, false);
        document.addEventListener("mouseup",   onMouseUp,   false);
      }
    }

    function onMouseMove(e) {
      if (!scope.enabled) return;
      e.preventDefault();
      var el = scope.domElement;
      switch (state) {
        case STATE.ROTATE:
          rotateEnd.set(e.clientX, e.clientY);
          rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);
          rotateLeft(2 * Math.PI * rotateDelta.x / el.clientHeight);
          rotateUp(2  * Math.PI * rotateDelta.y / el.clientHeight);
          rotateStart.copy(rotateEnd);
          scope.update();
          break;
        case STATE.DOLLY:
          dollyEnd.set(e.clientX, e.clientY);
          dollyDelta.subVectors(dollyEnd, dollyStart);
          if (dollyDelta.y > 0) dollyOut(getZoomScale());
          else if (dollyDelta.y < 0) dollyIn(getZoomScale());
          dollyStart.copy(dollyEnd);
          scope.update();
          break;
        case STATE.PAN:
          panEnd.set(e.clientX, e.clientY);
          panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);
          doPan(panDelta.x, panDelta.y);
          panStart.copy(panEnd);
          scope.update();
          break;
      }
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove, false);
      document.removeEventListener("mouseup",   onMouseUp,   false);
      state = STATE.NONE;
    }

    function onMouseWheel(e) {
      if (!scope.enabled || !scope.enableZoom) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY < 0) dollyIn(getZoomScale());
      else if (e.deltaY > 0) dollyOut(getZoomScale());
      scope.update();
    }

    /* Touch handlers */
    var touches0 = [];
    function onTouchStart(e) {
      if (!scope.enabled) return;
      touches0 = Array.from(e.touches);
      if (e.touches.length === 1) {
        rotateStart.set(e.touches[0].pageX, e.touches[0].pageY);
        state = STATE.ROTATE;
      } else if (e.touches.length === 2) {
        var dx = e.touches[0].pageX - e.touches[1].pageX;
        var dy = e.touches[0].pageY - e.touches[1].pageY;
        dollyStart.set(0, Math.sqrt(dx*dx+dy*dy));
        state = STATE.DOLLY;
      }
    }
    function onTouchMove(e) {
      if (!scope.enabled) return;
      e.preventDefault();
      if (e.touches.length === 1 && state === STATE.ROTATE) {
        rotateEnd.set(e.touches[0].pageX, e.touches[0].pageY);
        rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);
        var el = scope.domElement;
        rotateLeft(2 * Math.PI * rotateDelta.x / el.clientHeight);
        rotateUp(2  * Math.PI * rotateDelta.y / el.clientHeight);
        rotateStart.copy(rotateEnd);
        scope.update();
      } else if (e.touches.length === 2 && state === STATE.DOLLY) {
        var dx = e.touches[0].pageX - e.touches[1].pageX;
        var dy = e.touches[0].pageY - e.touches[1].pageY;
        dollyEnd.set(0, Math.sqrt(dx*dx+dy*dy));
        dollyDelta.subVectors(dollyEnd, dollyStart);
        if (dollyDelta.y > 0) dollyIn(dollyDelta.y / dollyStart.y);
        else dollyOut(dollyStart.y / dollyEnd.y);
        dollyStart.copy(dollyEnd);
        scope.update();
      }
    }
    function onTouchEnd() { state = STATE.NONE; }

    /* update() — called every frame */
    this.update = (function () {
      var offset    = new THREE.Vector3();
      var quat      = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0, 1, 0));
      var quatInv   = quat.clone().invert();
      var lastPos   = new THREE.Vector3();
      var lastQuat  = new THREE.Quaternion();

      return function () {
        var pos = scope.object.position;
        offset.copy(pos).sub(scope.target);
        offset.applyQuaternion(quat);
        spherical.setFromVector3(offset);

        if (scope.autoRotate && state === STATE.NONE) {
          rotateLeft(2 * Math.PI / 60 / 60 * scope.autoRotateSpeed);
        }

        if (scope.enableDamping) {
          spherical.theta += sphericalDelta.theta * scope.dampingFactor;
          spherical.phi   += sphericalDelta.phi   * scope.dampingFactor;
        } else {
          spherical.theta += sphericalDelta.theta;
          spherical.phi   += sphericalDelta.phi;
        }

        spherical.phi    = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));
        spherical.makeSafe();
        spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius * scale));

        if (scope.enableDamping) scope.target.addScaledVector(panOffset, scope.dampingFactor);
        else scope.target.add(panOffset);

        offset.setFromSpherical(spherical).applyQuaternion(quatInv);
        pos.copy(scope.target).add(offset);
        scope.object.lookAt(scope.target);

        if (scope.enableDamping) {
          sphericalDelta.theta *= (1 - scope.dampingFactor);
          sphericalDelta.phi   *= (1 - scope.dampingFactor);
          panOffset.multiplyScalar(1 - scope.dampingFactor);
        } else {
          sphericalDelta.set(0, 0, 0);
          panOffset.set(0, 0, 0);
        }
        scale = 1;

        if (lastPos.distanceToSquared(scope.object.position) > EPS ||
            8 * (1 - lastQuat.dot(scope.object.quaternion)) > EPS) {
          lastPos.copy(scope.object.position);
          lastQuat.copy(scope.object.quaternion);
          return true;
        }
        return false;
      };
    }());

    this.dispose = function () {
      scope.domElement.removeEventListener("mousedown",  onMouseDown);
      scope.domElement.removeEventListener("wheel",      onMouseWheel);
      scope.domElement.removeEventListener("touchstart", onTouchStart);
      scope.domElement.removeEventListener("touchmove",  onTouchMove);
      scope.domElement.removeEventListener("touchend",   onTouchEnd);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);
    };

    /* Attach events */
    scope.domElement.addEventListener("mousedown",  onMouseDown,  false);
    scope.domElement.addEventListener("wheel",      onMouseWheel, { passive: false });
    scope.domElement.addEventListener("touchstart", onTouchStart, { passive: false });
    scope.domElement.addEventListener("touchmove",  onTouchMove,  { passive: false });
    scope.domElement.addEventListener("touchend",   onTouchEnd,   false);

    this.update();
  };

  OrbitControls.prototype = Object.create(THREE.EventDispatcher.prototype);
  OrbitControls.prototype.constructor = OrbitControls;

  THREE.OrbitControls = OrbitControls;
  return OrbitControls;
});

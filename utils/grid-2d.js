'use strict';

const LinearTicks = require('./linear-ticks');

function _clamp (x, lo, hi) {
  return Math.min(Math.max(x, lo), hi);
}

function _uninterpolate(a, b) {
  b = (b -= a) || 1 / b;
  return function(x) { return (x - a) / b; };
}

function _interpolate(a, b) {
  return function(t) { return a * (1 - t) + b * t; };
}

function _snapPixel (x) {
  return Math.floor(x) + 0.5;
}

class Grid2D {
  constructor () {
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    this.worldPosition = [0, 0];

    this.hticks = null;
    this.xAxisScale = 1.0;
    this.xAxisOffset = 0.0;
    this.xAnchor = 0.5;

    this.vticks = null;
    this.yAxisScale = 1.0;
    this.yAxisOffset = 0.0;
    this.yAnchor = 0.5;

    // this is generated in setMapping
    this._vertices = [];
    this._xAnchorOffset = 0.0;
    this._yAnchorOffset = 0.0;

    // init direction
    this.xDirection = 1.0;
    this.yDirection = 1.0;
  }

  resize (w, h) {
    if ( !w || !h ) {
      // TODO
      // let rect = this._canvasEL.getBoundingClientRect();
      // w = w || rect.width;
      // h = h || rect.height;

      w = Math.round(w);
      h = Math.round(h);
    }

    // adjust xAxisOffset by anchor x
    if ( this.canvasWidth !== 0 ) {
      this.panX((w - this.canvasWidth) * (this.xAnchor + this._xAnchorOffset));
    }

    // adjust yAxisOffset by anchor y
    if ( this.canvasHeight !== 0 ) {
      this.panY((h - this.canvasHeight) * (this.yAnchor + this._yAnchorOffset));
    }

    this.canvasWidth = w;
    this.canvasHeight = h;

    // TODO
    // if ( this.renderer ) {
    //   this.renderer.resize( this.canvasWidth, this.canvasHeight );
    // }
  }

  // default 0.5, 0.5
  setAnchor ( x, y ) {
    this.xAnchor = _clamp( x, -1, 1 );
    this.yAnchor = _clamp( y, -1, 1 );
  }

  // recommended: [5,2], 0.001, 1000
  setScaleH ( lods, minScale, maxScale, type ) {
    this.hticks = new LinearTicks()
      .initTicks( lods, minScale, maxScale )
      .spacing ( 10, 80 )
      ;
    this.xAxisScale = _clamp(
      this.xAxisScale,
      this.hticks.minValueScale,
      this.hticks.maxValueScale
    );

    if ( type === 'frame' ) {
      this.hformat = frame => {
        return Editor.Utils.formatFrame( frame, 60.0 );
      };
    }

    this.pixelToValueH = x => {
      // return (x - this.canvasWidth * 0.5) / this.xAxisScale;
      return (x - this.xAxisOffset) / this.xAxisScale;
    };

    this.valueToPixelH = x => {
      // return x * this.xAxisScale + this.canvasWidth * 0.5;
      return x * this.xAxisScale + this.xAxisOffset;
    };
  }

  setMappingH ( minValue, maxValue, pixelRange ) {
    this._xAnchorOffset = minValue / (maxValue - minValue);
    this.xDirection = (maxValue - minValue) > 0 ? 1 : -1;

    this.pixelToValueH = x => {
      let pixelOffset = this.xAxisOffset;

      let ratio = this.canvasWidth / pixelRange;
      let u = _uninterpolate( 0.0, this.canvasWidth );
      let i = _interpolate( minValue * ratio, maxValue * ratio );
      return i(u(x - pixelOffset)) / this.xAxisScale;
    };

    this.valueToPixelH = x => {
      let pixelOffset = this.xAxisOffset;

      let ratio = this.canvasWidth / pixelRange;
      let u = _uninterpolate( minValue * ratio, maxValue * ratio );
      let i = _interpolate( 0.0, this.canvasWidth );
      return i(u(x * this.xAxisScale)) + pixelOffset;
    };
  }

  setRangeH ( minValue, maxValue ) {
    this.xMinRange = minValue;
    this.xMaxRange = maxValue;
  }

  setScaleV ( lods, minScale, maxScale, type ) {
    this.vticks = new LinearTicks()
    .initTicks( lods, minScale, maxScale )
    .spacing ( 10, 80 )
    ;
    this.yAxisScale = _clamp(
      this.yAxisScale,
      this.vticks.minValueScale,
      this.vticks.maxValueScale
    );

    if ( type === 'frame' ) {
      this.vformat = frame => {
        return Editor.Utils.formatFrame( frame, 60.0 );
      };
    }

    this.pixelToValueV = y => {
      // return (this.canvasHeight*0.5 - y) / this.yAxisScale;
      return (this.canvasHeight - y + this.yAxisOffset) / this.yAxisScale;
    };

    this.valueToPixelV = y => {
      // return -y * this.yAxisScale + this.canvasHeight*0.5;
      return -y * this.yAxisScale + this.canvasHeight + this.yAxisOffset;
    };
  }

  setMappingV ( minValue, maxValue, pixelRange ) {
    this._yAnchorOffset = minValue / (maxValue - minValue);
    this.yDirection = (maxValue - minValue) > 0 ? 1 : -1;

    this.pixelToValueV = y => {
      let pixelOffset = this.yAxisOffset;

      let ratio = this.canvasHeight / pixelRange;
      let u = _uninterpolate( 0.0, this.canvasHeight );
      let i = _interpolate( minValue * ratio, maxValue * ratio );
      return i(u(y - pixelOffset)) / this.yAxisScale;
    };

    this.valueToPixelV = y => {
      let pixelOffset = this.yAxisOffset;

      let ratio = this.canvasHeight / pixelRange;
      let u = _uninterpolate( minValue * ratio, maxValue * ratio );
      let i = _interpolate( 0.0, this.canvasHeight );
      return i(u(y * this.yAxisScale)) + pixelOffset;
    };
  }

  setRangeV ( minValue, maxValue ) {
    this.yMinRange = minValue;
    this.yMaxRange = maxValue;
  }

  pan ( deltaPixelX, deltaPixelY ) {
    this.panX(deltaPixelX);
    this.panY(deltaPixelY);
  }

  panX ( deltaPixelX ) {
    if ( !this.valueToPixelH ) {
      return;
    }

    let newOffset = this.xAxisOffset + deltaPixelX;
    this.xAxisOffset = 0.0; // calc range without offset

    let min, max;
    if ( this.xMinRange !== undefined && this.xMinRange !== null ) {
      min = this.valueToPixelH(this.xMinRange);
    }
    if ( this.xMaxRange !== undefined && this.xMaxRange !== null ) {
      max = this.valueToPixelH(this.xMaxRange);
      max = Math.max(0, max - this.canvasWidth);
    }

    this.xAxisOffset = newOffset;

    if ( min !== undefined && max !== undefined ) {
      this.xAxisOffset = _clamp( this.xAxisOffset, -max, -min );
      return;
    }

    if ( min !== undefined ) {
      this.xAxisOffset = Math.min( this.xAxisOffset, -min );
      return;
    }

    if ( max !== undefined ) {
      this.xAxisOffset = Math.max( this.xAxisOffset, -max );
      return;
    }
  }

  panY ( deltaPixelY ) {
    if ( !this.valueToPixelV ) {
      return;
    }

    let newOffset = this.yAxisOffset + deltaPixelY;
    this.yAxisOffset = 0.0; // calc range without offset

    let min, max;
    if ( this.yMinRange !== undefined && this.yMinRange !== null ) {
      min = this.valueToPixelV(this.yMinRange);
    }
    if ( this.yMaxRange !== undefined && this.yMaxRange !== null ) {
      max = this.valueToPixelV(this.yMaxRange);
      max = Math.max(0, max - this.canvasHeight);
    }

    this.yAxisOffset = newOffset;

    if ( min !== undefined && max !== undefined ) {
      this.yAxisOffset = _clamp( this.yAxisOffset, -max, -min );
      return;
    }

    if ( min !== undefined ) {
      this.yAxisOffset = Math.min( this.yAxisOffset, -min );
      return;
    }

    if ( max !== undefined ) {
      this.yAxisOffset = Math.max( this.yAxisOffset, -max );
      return;
    }
  }

  xAxisScaleAt ( pixelX, scale ) {
    let oldValueX = this.pixelToValueH(pixelX);
    this.xAxisScale = _clamp( scale, this.hticks.minValueScale, this.hticks.maxValueScale );
    let newScreenX = this.valueToPixelH(oldValueX);
    this.pan( pixelX - newScreenX, 0 );
  }

  yAxisScaleAt ( pixelY, scale ) {
    let oldValueY = this.pixelToValueV(pixelY);
    this.yAxisScale = _clamp( scale, this.vticks.minValueScale, this.vticks.maxValueScale );
    let newScreenY = this.valueToPixelV(oldValueY);
    this.pan( 0, pixelY - newScreenY );
  }

  xAxisSync ( x, scaleX ) {
    this.xAxisOffset = x;
    this.xAxisScale = scaleX;
  }

  yAxisSync ( y, scaleY ) {
    this.yAxisOffset = y;
    this.yAxisScale = scaleY;
  }

  _updateGrids () {
    // let lineColor = 0x555555;
    let ticks, ratio;
    let screen_x, screen_y;

    this._vertices = [];

    // draw h ticks
    if ( this.hticks ) {
      let left = this.pixelToValueH(0);
      let right = this.pixelToValueH(this.canvasWidth);
      this.hticks.range( left, right, this.canvasWidth );

      for ( let i = this.hticks.minTickLevel; i <= this.hticks.maxTickLevel; ++i ) {
        ratio = this.hticks.tickRatios[i];
        if ( ratio > 0 ) {
          // TODO
          // this.bgGraphics.lineStyle(1, lineColor, ratio * 0.5);

          ticks = this.hticks.ticksAtLevel(i,true);
          for ( let j = 0; j < ticks.length; ++j ) {
            screen_x = this.valueToPixelH(ticks[j]);
            this._vertices.push( _snapPixel(screen_x), -1.0, 0.0 );
            this._vertices.push( _snapPixel(screen_x), this.canvasHeight, 0.0 );
          }
        }
      }
    }

    // draw v ticks
    if ( this.vticks ) {
      let top = this.pixelToValueV(0);
      let bottom = this.pixelToValueV(this.canvasHeight);
      this.vticks.range( top, bottom, this.canvasHeight );

      for ( let i = this.vticks.minTickLevel; i <= this.vticks.maxTickLevel; ++i ) {
        ratio = this.vticks.tickRatios[i];
        if ( ratio > 0 ) {
          // TODO
          // this.bgGraphics.lineStyle(1, lineColor, ratio * 0.5);

          ticks = this.vticks.ticksAtLevel(i,true);
          for ( let j = 0; j < ticks.length; ++j ) {
            screen_y = this.valueToPixelV( ticks[j] );
            this._vertices.push( 0.0, _snapPixel(screen_y), 0.0 );
            this._vertices.push( this.canvasWidth, _snapPixel(screen_y), 0.0 );
          }
        }
      }
    }

    // DISABLE
    // // draw label
    // if ( this.showLabelH || this.showLabelV ) {
    //   var minStep = 50, labelLevel, labelEL, tickValue;
    //   var decimals, fmt;

    //   this._resetLabels();

    //   // draw hlabel
    //   if ( this.showLabelH && this.hticks ) {
    //     labelLevel = this.hticks.levelForStep(minStep);
    //     ticks = this.hticks.ticksAtLevel(labelLevel,false);

    //     tickValue = this.hticks.ticks[labelLevel];
    //     decimals = Math.max( 0, -Math.floor(Math.log10(tickValue)) );
    //     fmt = '0,' + Number(0).toFixed(decimals);

    //     var hlabelsDOM = Polymer.dom(this.$.hlabels);

    //     let j;
    //     for ( j = 0; j < ticks.length; ++j ) {
    //       screen_x = _snapPixel(this.valueToPixelH(ticks[j])) + 5;

    //       if ( j < hlabelsDOM.children.length ) {
    //         labelEL = hlabelsDOM.children[j];
    //       } else {
    //         labelEL = this._createLabel();
    //         hlabelsDOM.appendChild(labelEL);
    //       }

    //       if ( this.hformat ) {
    //         labelEL.innerText = this.hformat(ticks[j]);
    //       } else {
    //         labelEL.innerText = Numeral(ticks[j]).format(fmt);
    //       }

    //       labelEL.style.display = 'block';
    //       labelEL.style.left = _snapPixel(screen_x) + 'px';
    //       labelEL.style.bottom = '0px';
    //       labelEL.style.right = '';
    //       labelEL.style.top = '';
    //       // labelEL.style.transform = 'translate3d(' + screen_x + 'px,' + '-15px,' + '0px)';
    //     }
    //     this._hlabelIdx = j;
    //   }

    //   // draw vlabel
    //   if ( this.showLabelV && this.vticks ) {
    //     labelLevel = this.vticks.levelForStep(minStep);
    //     ticks = this.vticks.ticksAtLevel(labelLevel,false);

    //     tickValue = this.vticks.ticks[labelLevel];
    //     decimals = Math.max( 0, -Math.floor(Math.log10(tickValue)) );
    //     fmt = '0,' + Number(0).toFixed(decimals);

    //     var vlabelsDOM = Polymer.dom(this.$.vlabels);

    //     let j;
    //     for ( j = 0; j < ticks.length; ++j ) {
    //       screen_y = _snapPixel(this.valueToPixelV(ticks[j])) - 15;

    //       if ( j < vlabelsDOM.children.length ) {
    //         labelEL = vlabelsDOM.children[j];
    //       } else {
    //         labelEL = this._createLabel();
    //         vlabelsDOM.appendChild(labelEL);
    //       }

    //       if ( this.vformat ) {
    //         labelEL.innerText = this.vformat(ticks[j]);
    //       } else {
    //         labelEL.innerText = Numeral(ticks[j]).format(fmt);
    //       }

    //       labelEL.style.display = 'block';
    //       labelEL.style.left = '0px';
    //       labelEL.style.top = _snapPixel(screen_y) + 'px';
    //       labelEL.style.bottom = '';
    //       labelEL.style.right = '';
    //       // labelEL.style.transform = 'translate3d(0px,' + screen_y + 'px,' + '0px)';
    //     }
    //     this._vlabelIdx = j;
    //   }

    //   //
    //   this._hideUnusedLabels();
    // }

    // // DEBUG
    // if ( this.showDebugInfo ) {
    //   this.set('debugInfo.xAxisScale', this.xAxisScale.toFixed(3));
    //   this.set('debugInfo.xAxisOffset', this.xAxisOffset.toFixed(3));

    //   if ( this.hticks ) {
    //     this.set('debugInfo.xMinLevel', this.hticks.minTickLevel);
    //     this.set('debugInfo.xMaxLevel', this.hticks.maxTickLevel);
    //   }

    //   this.set('debugInfo.yAxisScale', this.yAxisScale.toFixed(3));
    //   this.set('debugInfo.yAxisOffset', this.yAxisOffset.toFixed(3));

    //   if ( this.vticks ) {
    //     this.set('debugInfo.yMinLevel', this.vticks.minTickLevel);
    //     this.set('debugInfo.yMaxLevel', this.vticks.maxTickLevel);
    //   }
    // }
    // DISABLE
  }
}

module.exports = Grid2D;


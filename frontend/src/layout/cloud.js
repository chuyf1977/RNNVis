import * as d3 from 'd3';
import cloud from 'd3-cloud';
// import cloud from './forcecloud.js';
// console.log(d3);
// var cloud = require('./d3.cloud.js');
// console.log('haha');

const bgLayout = {
  'stroke': 'gray',
  'stroke-width': 0.5,
  'fill': 'white',
  'fill-opacity': 0.0,
  'stroke-opacity': 0.8,
};

const wordLayout = {
  'font': 'Arial',
  'fontSize': [6, 17],
  'fontWeight': [200, 500],
  'padding': 0,
}

export class WordCloud{
  constructor(selector, radiusX = 100, radiusY = radiusX, bgshape = 'rect') {
    this.selector = selector;
    this.bggroup = this.selector.append('g');
    this.bg = this.bggroup.append('g');
    this.bgHandle;
    this.bgshape = bgshape;
    this.bgLayout = bgLayout;
    this.wordLayout = wordLayout;
    this.group = this.bggroup.append('g');
    this.radius = [radiusX, radiusY];
    this.data;
    this.cloud = null;  // the handle to all the texts
    this.font = 'Impact';
    this.margin_ = 0;
    this.colorScheme = d3.scaleOrdinal(d3.schemeCategory10);
    // this.bounding();
  }
  get width() {
    return (this.radius[0] - this.margin_) * 2;
  }
  get height() {
    return (this.radius[1] - this.margin_) * 2;
  }
  get polygon() {
    let polygon = [];
    const len = 4;
    for (let i = 0; i < len; i++) {
      polygon.push([
        Math.round(this.radiusX * Math.cos(2 * Math.PI * i / len)),
        Math.round(this.radiusY * Math.sin(2 * Math.PI * i / len))]);
    }
    return polygon;
  }
  size(size) {
    this.radius[0] = size[0] / 2;
    this.radius[1] = size[1] / 2;
    return this;
  }
  wordLayoutParams(layoutParams) {
    return arguments.length ? (this.wordLayout = layoutParams, this) : this.wordLayout;
  }
  bgLayoutParams(layoutParams) {
    return arguments.length ? (this.bgLayout = layoutParams, this) : this.bgLayout;
  }
  transform(transformStr) {
    this.bggroup.attr('transform', transformStr);
    return this;
  }
  // set the background color and opacity
  background(color, alpha = 1.0) {
    this.bgLayout['fill'] = color;
    this.bgLayout['fill-opacity'] = alpha;
    return this;
  }
  drawBackground() {
    // console.log("Redrawing backgrounds")
    this.bgHandle = this.bg.append(this.bgshape)
    if (this.bgshape === 'rect') {
      this.bgHandle
        .attr('x', -this.radius[0])
        .attr('y', -this.radius[1])
        .attr('rx', 4)
        .attr('ry', 4)
        .attr('width', 2 * this.radius[0])
        .attr('height', 2 * this.radius[1])
    } else if (this.bgshape === 'ellipse') {
      this.bgHandle
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('rx', radius[0])
        .attr('ry', radius[1]);
    }
    Object.keys(this.bgLayout).forEach((param) => {
      this.bgHandle.attr(param, this.bgLayout[param]);
    });
    return this;
  }
  margin(margin) {
    this.margin_ = margin;
    // this.group.attr('transform', `scale()`)
    return this;
  }
  fontFamily(font) {
    this.wordLayout.font = font;
    return this;
  }
  color(colorScheme) {
    this.colorScheme = colorScheme;
  }
  draw(size = [this.width, this.height], data = this.data) {
    // console.log(this.cloud);
    if (size[0] !== this.width || size[1] !== this.height) {
      this.bgHandle.remove();
      this.bgHandle = null;
      this.size(size);
    }
    if (!this.bgHandle) {
      this.drawBackground();
    }
    this.data = data;
    // console.log(data);
    const radiusX = size[0] / 2;
    const radiusY = size[1] / 2;
    // this.group.attr('transform', 'translate(' + [-radiusX, -radiusY] + ')');
    const filterData = data.filter((d) => {
      return -radiusX < d.x - d.width / 4 && -radiusY < d.y - d.size && d.x + d.width/4 < radiusX && d.y < radiusY;
    });
    const self = this;
    this.cloud = this.group.selectAll('g text')
      .data(filterData, function (d) { return d.text; }); // matching key

    //Entering words
    const text = this.cloud.enter()
      .append('text')
      .style('font-family', this.wordLayout.font)
      .style('fill', (d, i) => { return self.colorScheme(d.type); })
      .attr('text-anchor', 'middle')
      // .attr('font-size', 1);
    text
      .text(function (d) { return d.text; })
      .attr('transform', function (d) {
        return 'translate(' + [d.x, d.y] + ')';
      })
      // .attr('font-size', 1)
      .attr('font-size', function (d) { return d.size + 'px'; })
      // .attr('font-weight', function(d) { return d.weight; })
      .transition()
      .duration(300)
      .style('fill-opacity', 1);;

    //Exiting words
    this.cloud.exit()
      .transition()
      .duration(200)
      .style('fill-opacity', 1e-6)
      .attr('font-size', 1)
      .remove();

    // this._txt = null;
    // autoscale
    // setTimeout(() => self.autoscale(bounds), 100);
  }
  update(words) {
    const self = this;
    // console.log(words);
    words.sort((a, b) => {return a.size - b.size; });
    const fontExtent = d3.extent(words, (d) => d.size);
    const scale = d3.scalePow()
      .range(this.wordLayout.fontSize)
      .domain(fontExtent);
    const weightScale = d3.scaleLinear()
      .range(this.wordLayout.fontWeight)
      .domain(fontExtent);
    words.forEach((word) => {
      word.weight = Math.round(weightScale(word.size));
      word.size = scale(word.size);
    });
    // d3.cloud()
    cloud()
      .size([this.width*1.2, this.height*1.2]) // when layout, first give a larger region
      .words(words)
      .padding(this.wordLayout.padding)
      .rotate(0)
      .font(this.wordLayout.font)
      .text(d => d.text)
      .fontSize(d => d.size)
      // .fontWeight(d => d.weight)
      .on('end', (words) => self.draw([self.width, self.height], words))
      .random(()=> 0.5)
      .spiral('rectangular')
      .start();
    // return this
  }
  autoscale(bounds) {

    // console.log(`centerx: ${centerX}, centerY: ${centerY}`);
    const scaleX = 0.9 * this.width / Math.abs(bounds[0].x - bounds[1].x);
    const scaleY = 0.9 * this.height / Math.abs(bounds[0].y - bounds[1].y);
    const scale = Math.min(scaleX, scaleY);
    const centerX = (bounds[1].x + bounds[0].x - this.width) / 2 * scale;
    const centerY = (bounds[1].y + bounds[0].y - this.height) / 2 * scale;
    this.group.attr('transform', `scale(${scale}) translate(${-centerX}, ${-centerY})`);
  }
}

export default {
  WordCloud,
};
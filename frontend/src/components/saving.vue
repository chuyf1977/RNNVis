<style>
.hidden-cluster {
  stroke: gray;
  stroke-opacity: 0.5;
  stroke-width: 0.5;
  fill: lightgray;
  fill-opacity: 0.3;
}
.cluster-selected {
  stroke-width: 1.5;
  stroke-opacity: 0.5;
  stroke: black;
  fill-opacity: 0.3;
}
#middle_line {
  stroke: lightskyblue;
  stroke-width: 2;
  stroke-dasharray: 3, 3;
  fill: none;
  opacity: 0.5;
}
.little-triangle {
  fill: #1f77b4;
}
.link.active {
  opacity: 1;
}
.link {
  fill: none;
  opacity: 0.2;
}
.state_unit {

}
.state_unit .active {

}
.active-word {

}

</style>
<template>
  <div>
    <!--<div class="header">
      <el-radio-group v-model="selectedState" size="small">
        <el-radio-button v-for="state in states" :label="state"></el-radio-button>
      </el-radio-group>
    </div>-->
    <svg :id='svgId' :width='width' :height='height' :transform='compare ? "scale(-1,1)" : ""'> </svg>
  </div>
</template>

<script>
  import * as d3 from 'd3'
  import { bus, SELECT_MODEL, SELECT_STATE, CHANGE_LAYOUT, SELECT_WORD, EVALUATE_SENTENCE} from '../event-bus'
  import { WordCloud } from '../layout/cloud.js';
  import { sentence } from '../layout/sentence.js';


  const layoutParams = {
    clusterInterval: 15,
    packNum: 3,
    unitWidth: 3,
    unitHeight: 3,
    unitMargin: 2,
    wordCloudArcDegree: 130,
    wordCloudNormalRadius: 60,
    wordCloudShrinkHeight: 5,
    wordCloudPaddingLength: 10,
    wordCloudChord2stateClusterHeightRatio: 1.2,
    wordCloudWidth2HeightRatio: 1.2,
    littleTriangleWidth: 5,
    littleTriangleHeight: 5,
    strengthThresholdPercent: 0.2,
    linkWidth2StrengthRatio: 0.01,
    wordSize2StrengthRatio: 3,
    get clusterHeight() {
      return this.unitHeight * this.packNum + this.unitMargin * (this.packNum + 1);
    },
    computeParams (clientHeight, clusterNum) {
      this.wordCloudChordLength = clientHeight * 0.9;
      this.clusterHeight = (this.wordCloudChordLength / this.wordCloudChord2stateClusterHeightRatio + clusterInterval) / clusterNum - clusterInterval;
      this.packNum = this.clusterHeight / (this.unitHeight + unitMargin)
      this.unitHeight = (this.clusterHeight + unitMargin)
    }
    // clusterRectStyle: {
    //   'fill': '#eee',
    //   'fill-opacity': 0.5,
    //   'stroke': '#555',
    //   'stroke-width': 0.5,
    //   'stroke-opacity': 0.5,
    // },
  };
  // layoutParams.clusterHeight = layoutParams.unitHeight*layoutParams.packNum + layoutParams.unitMargin * (layoutParams.packNum + 1);
  // layoutParams.clusterWidth = layoutParams.clusterHeight / (layoutParams.packNum);

  export default {
    name: 'ClusterView',
    data() {
      return {
        params: layoutParams,
        // svgId: 'cluster-svg',
        clusterData: null,
        // clusterNum: 10,
        painter: null,
        painter2: null,
        shared: bus.state,
        width: 800,
        changingFlag: false,
      }
    },
    props: {
      compare: {
        type: Boolean,
        defautl: false,
      },
      height: {
        type: Number,
        default: 800,
      },
    },
    computed: {
      svgId: function () {
        return this.compare ? 'cluster-svg2' : 'cluster-svg';
      },
      selectedState: function() {
        console.log(`cluster > state changed to ${this.shared.selectedState}`);
        return this.compare ? this.shared.selectedState2 : this.shared.selectedState;
      },
      selectedModel: function() {
        return this.compare ? this.shared.selectedModel2 : this.shared.selectedModel;
      },
      selectedLayer: function() {
        return this.compare ? this.shared.selectedLayer2 : this.shared.selectedLayer;
      },
      layout: function() {
        return this.compare ? this.shared.layout2 : this.shared.layout;
      },
      clusterNum: function() {
        return this.layout.clusterNum;
      },
      selectedWords: function() {
        return this.compare ? this.shared.selectedWords2 : this.shared.selectedWords;
      },
      selectedUnits: function() {
        return this.compare ? this.shared.selectedUnits2 : this.shared.selectedUnits;
      },
    },
    watch: {
      selectedState: function (state) {
        this.maybeReload();
      },
      selectedLayer: function (layer) {
        this.maybeReload();
      },
      layout: function(layout) {
        console.log("cluster > Changing Layout...");
        this.maybeReload();
      },
      selectedModel: function (newModel, oldModel) {
        this.maybeReload();
      },
      selectedWords: function (words) {
        if (words.length === 0) {
          this.painter.render_state([]);
          return;
        }
        // const words = words.map((word) => word.text);
        // this.compare = compare;
        let model = this.selectedModel,
          state = this.selectedState,
          layer = this.selectedLayer;
        const p = bus.loadStatistics(model, state, layer)
          .then(() => {
            const statistics = bus.getStatistics(model, state, layer);
            const wordsStatistics = statistics.statOfWord(this.selectedWords[0].text).mean;
            this.painter.render_state(wordsStatistics);
          });
      },
    },
    methods: {
      checkLegality() {
        const state = this.selectedState;
        return (state === 'state' || state === 'state_c' || state === 'state_h')
          && ((typeof this.selectedLayer) === 'number') && (this.layout);
      },
      maybeReload() {
        // console.log(this.changingFlag);
        if (!this.changingFlag){
          this.changingFlag = true;
          // console.log(this.changingFlag);
          if (this.checkLegality()){
            console.log('reloading');
            this.reload(this.selectedModel, this.selectedState, this.selectedLayer, this.clusterNum)
              .then(() => {
                this.changingFlag = false;
              });
          }
        }
      },
      init() {
        this.painter = new Painter(`#${this.svgId}`, this.params, this.compare);
      },
      reload(model, state, layer, clusterNum) {
        const params = {
          top_k: 300,
          mode: 'raw',
          layer: layer,
        };
        return bus.loadCoCluster(model, state, clusterNum, params)
          .then(() => {
            this.clusterData = bus.getCoCluster(model, state, clusterNum, params);
            this.painter.destroy();
            this.painter.draw(this.clusterData);
          });
      },
    },
    mounted() {
      this.width = this.$el.clientWidth;
      this.init();
      // register events
      // bus.$on(SELECT_MODEL, (model) => {
      //   this.selectedModel = model;
      //   bus.loadModelConfig(model).then(() => {
      //     this.states = bus.availableStates(model);
      //   });
      // });
      bus.$on(EVALUATE_SENTENCE, (value, compare) => {
        // const p1 = bus.loadCoCluster(this.selectedModel, this.selectedState, this.clusterNum, {top_k: 300, mode: 'raw'});
        const record = bus.evalSentence(value, this.selectedModel);
        const p2 = record.evaluate();
        Promise.all([p2]).then((values) => {
          // const coCluster = bus.getCoCluster(this.selectedModel, this.selectedState, this.clusterNum, {top_k: 300, mode: 'raw'});
          // TODO change -1 to something else
          const sentenceRecord = record.getRecords(this.selectedState, -1);
          this.painter.drawSentence(record, sentenceRecord);
          
        })
      });
      bus.$on(CHANGE_LAYOUT, (layout, compare) => {
        if (compare)
          return;
        console.log("cluster > Changing Layout...");
        // this.clusterNum = layout.clusterNum;
      });
    }
  }

  class Painter {
    constructor(selector, params = layoutParams, compare=false) {
      this.svg = d3.select(selector);
      this.params = params;
      this.hwg = this.svg.append('g');
      this.hg = this.hwg.append('g');
      this.wg = this.hwg.append('g');

      this.client_width = this.svg.node().getBoundingClientRect().width;
      this.client_height = this.svg.node().getBoundingClientRect().height;
      this.middle_line_x = 400;
      this.middle_line_y = 50;
      this.triangle_height = 5;
      this.triangle_width = 5;

      this.dx = 0, this.dy = 0;
      this.graph = null;
      this.clusterSelected = [];

      this.state_elements = [];
      this.loc = null;
      this.wordClouds = [];

      this.unitNormalColor = '#ff7f0e';
      this.unitRangeColor = ['#09adff', '#ff5b09'];
      this.linkWidthRanage = [1, 5];
      this.linkColor = ['#09adff', '#ff5b09'];
      this.compare = compare;

    }

    drawSentence(record, sentenceRecord) {
      const sg = this.svg.append('g');
      const scaleFactor = 0.7;
      const translationX = 400;
      this.hwg
        .attr('transform', `scale(${scaleFactor}, 1)translate(${translationX}, 0)`);
      console.log(record);
      // TODO change -1 to something else
      const a = sentence(sg)
        .size([100, this.client_height])
        .sentence(sentenceRecord)
        .coCluster(this.graph.coCluster)
        .words(record.tokens)
        .draw();
      
      let links = [];
      console.log(a.dataList);
      a.dataList.forEach((d, i) => {
        const wordPos = a.getWordPos(i);
        this.graph.state_info.state_cluster_info.forEach((s, j) => {
          let link = {
            source: {x: a.getWordPos(i)[0] + a.nodeWidth, y: a.getWordPos(i)[1] + a.nodeHeight/2},
            target: {x: (s.top_left[0] + this.middle_line_x) * scaleFactor + translationX, y: s.top_left[1] + this.middle_line_y},
          };
          links.push(link);
        });
      });

      sg.selectAll('path')
        .data(links).enter()
        .append('path')
        .attr('d', l => this.createLink(l))
        .attr('fill', 'none')
        .attr('stroke-width', 2)
        .attr('stroke', 'blue')
    }

    calculate_state_info(coCluster) {
      let state_loc = [];
      let state_cluster_loc = [];
      let little_triangle_loc = [];

      const clusterHeight = this.params.clusterHeight;
      const packNum = this.params.packNum;
      const unitHeight = this.params.unitHeight;
      const unitWidth = this.params.unitWidth;
      const unitMargin = this.params.unitMargin;
      const clusterInterval = this.params.clusterInterval;

      const stateClusters = coCluster.colClusters;
      const agg_info = coCluster.aggregation_info;
      const nCluster = coCluster.labels.length;
      const words = coCluster.words;

      stateClusters.forEach((clst, i) => {
        let width = Math.ceil(clst.length / packNum) * (unitWidth + unitMargin) + unitMargin;
        let height = clusterHeight;
        let top_left = [-width / 2, i * (clusterHeight + clusterInterval)];

        state_cluster_loc[i] = {top_left: top_left, width: width, height: height};

        clst.forEach((c, j) => {
          let s_width = unitWidth;
          let s_height = unitHeight;
          let s_top_left = [(~~(j/packNum)) * (unitMargin + unitWidth) + 1 + top_left[0],
            j%packNum * (unitHeight + unitMargin) + 1 + top_left[1]];
          state_loc[c] = {top_left: s_top_left, width: s_width, height: s_height};
        });
      });
      return {state_cluster_info: state_cluster_loc, state_info: state_loc};
    }

    calculate_word_info(coCluster, selected_state_cluster_index=-1) {
      let self = this;
      const wordCloudNormalRadius = this.params.wordCloudNormalRadius;
      const wordCloudArcDegree = this.params.wordCloudArcDegree;
      const clusterInterval = this.params.clusterInterval;
      const clusterHeight = this.params.clusterHeight;
      const wordCloudPaddingLength = this.params.wordCloudPaddingLength;
      const wordCloudChord2stateClusterHeightRatio = this.params.wordCloudChord2stateClusterHeightRatio;
      const wordCloudShrinkHeight = this.params.wordCloudShrinkHeight;
      const wordSize2StrengthRatio = this.params.wordSize2StrengthRatio;
      const wordCloudWidth2HeightRatio = this.params.wordCloudWidth2HeightRatio;
      const wordClusters = coCluster.rowClusters;
      const words = coCluster.words;
      const nWord = words.length;
      const nCluster = coCluster.labels.length;
      const agg_info = coCluster.aggregation_info;

      let chordLength = nCluster * (clusterHeight + clusterInterval) * wordCloudChord2stateClusterHeightRatio;
      let availableLength = chordLength - nCluster * wordCloudPaddingLength;

      const wordCloudArcRadius = chordLength / 2 / Math.sin(wordCloudArcDegree / 2 * Math.PI / 180);
      this.params.wordCloudArcRadius = wordCloudArcRadius;
      // const wordCloudArcLength = wordCloudArcRadius * wordCloudArcDegree * Math.PI / 180;

      let highlight_clouds = [];
      if (selected_state_cluster_index >= 0) {
        self.graph.link_info[selected_state_cluster_index].forEach((d, j) => {
          if (d.strength > 0) {
            highlight_clouds.push(j);
          }
        });
      }
      highlight_clouds = new Set(highlight_clouds);
      let word_info = [];
      let wd_height = wordClusters.map((d, i) => {
        if (highlight_clouds.size === 0) {
          return Math.sqrt(d.length);
        } else if (!highlight_clouds.has(i)) {
          // return wordCloudShrinkHeight;
          return Math.sqrt(d.length);
        } else {
          return Math.sqrt(d.length) * 1.5;
        }
      });
      // console.log('wd_radius');
      // console.log(wd_radius);

      // let availableDegree = wordCloudArcDegree - nCluster * wordCloudPaddingDegree;
      let wd_height_sum = wd_height.reduce((acc, val) => {
        return acc + val;
      }, 0);

      let offset = -chordLength / 2;
      wordClusters.forEach((wdst, i) => {
        // let angle = wd_radius[i] / wd_radius_sum * availableDegree / 2;
        // let actual_radius = wordCloudArcRadius * angle * Math.PI / 180;
        // let angle_loc = angle + offset;
        const actual_height = wd_height[i] / wd_height_sum * availableLength;
        const actual_width = actual_height * wordCloudWidth2HeightRatio;
        const top_left_y = offset;
        const top_left_x = Math.sqrt(wordCloudArcRadius ** 2 - top_left_y ** 2);
        offset += actual_height + wordCloudPaddingLength;
        // if self.graph exist, then only update the location info
        if (self.graph && self.graph.word_info) {
          self.graph.word_info[i].top_left = [top_left_x, top_left_y];
          self.graph.word_info[i].width = actual_width;
          self.graph.word_info[i].height = actual_height;
          word_info[i] = self.graph.word_info[i];
        } else {
          const words_data = wdst.map((d) => {
            return {text: words[d], size: agg_info.row_single_2_col_cluster[d][i] * wordSize2StrengthRatio};
          });
          word_info[i] = {top_left: [top_left_x, top_left_y], width: actual_width,
            height: actual_height, words_data: words_data};
        }
      });
      return word_info;
    }

    calculate_link_info(state_info, word_info, coCluster, dx, dy) {
      const self = this;
      const strengthThresholdPercent = this.params.strengthThresholdPercent;
      let links = [];
      const row_cluster_2_col_cluster = coCluster.aggregation_info.row_cluster_2_col_cluster;
      console.log('row_cluster_2_col_cluster');
      console.log(row_cluster_2_col_cluster);
      state_info.state_cluster_info.forEach((s, i) => {
        let strength_extent = 0;
        if (!self.graph || !this.graph.link_info) {
          strength_extent = d3.extent(row_cluster_2_col_cluster[i]);
          console.log(`threshold is ${strength_extent[0]*strengthThresholdPercent}, ${strength_extent[1]*strengthThresholdPercent}`);
        }
        word_info.forEach((w, j) => {
          if (links[i] === undefined) {
            links[i] = [];
          }
          // if self.graph exists, then only update the location info, keep
          if (this.graph && this.graph.link_info) {
            // console.log(self.graph.link_info[i][j].el);
            links[i][j] = {source: {x: s.top_left[0] + s.width,
              y: s.top_left[1] + s.height / 2},
              target: {x: w.top_left[0] + dx, y: w.top_left[1] + w.height/2 + dy},
              strength: self.graph.link_info[i][j].strength,
              el: self.graph.link_info[i][j].el,
            };
          } else {
            let tmp_strength = row_cluster_2_col_cluster[i][j];
            if (tmp_strength > 0) {
              tmp_strength = tmp_strength > strength_extent[1] * strengthThresholdPercent ? tmp_strength : 0;
            } else {
              tmp_strength = tmp_strength < strength_extent[0] * strengthThresholdPercent ? tmp_strength : 0;
            }
            links[i][j] = {source: {x: s.top_left[0] + s.width,
              y: s.top_left[1] + s.height / 2},
              target: {x: w.top_left[0] + dx, y: w.top_left[1] + w.height/2 + dy},
              strength: tmp_strength,
            };
          }

        });
      });
      return links;
    }

    ArcLength2Angle(length, radius) {
      return length / radius * 180 / Math.PI;
    }

    render_state(data) {
      if (data.length) {
        this.graph.state_info.state_info.forEach((s, i) => {
          d3.select(s['el'])
            .transition()
            .duration(300)
            .attr('fill', data[i] > 0 ? this.unitRangeColor[1] : this.unitRangeColor[0])
            .attr('fill-opacity', Math.abs(data[i]))
        });
      } else {
        this.graph.state_info.state_info.forEach((s, i) => {
          d3.select(s['el'])
            .transition()
            .duration(300)
            .attr('fill', this.unitNormalColor)
        });
      }
    }

    redraw_word_link(selected_state_cluster_index = -1) {
      let self = this;
      self.erase_word();
      self.erase_link();
      self.graph.word_info = self.calculate_word_info(self.graph.coCluster, selected_state_cluster_index);
      self.graph.link_info = self.calculate_link_info(self.graph.state_info, self.graph.word_info, self.graph.coCluster, self.dx, self.dy);
      self.draw_word(self.wg, self.graph);
      self.draw_link(self.hg, self.graph);
    }

    draw_state(g, graph) {
      let self = this;
      let coCluster = graph.coCluster;
      let state_info = graph.state_info;
      const clusterHeight = this.params.clusterHeight;
      const packNum = this.params.packNum;
      const unitHeight = this.params.unitHeight;
      const unitWidth = this.params.unitWidth;
      const unitMargin = this.params.unitMargin;
      const clusterInterval = this.params.clusterInterval;
      const littleTriangleWidth = this.params.littleTriangleWidth;
      const littleTriangleHeight = this.params.littleTriangleHeight;

      if (this.clusterSelected.length !== coCluster.colClusters.length) {
        this.clusterSelected = coCluster.colClusters.map((d, i) => 0);
      }
      const clusterSelected = this.clusterSelected;
      g.append('line')
        .attr('id', 'middle_line')
        .attr('x1', 0)
        .attr('y1', -1000)
        .attr('x2', 0)
        .attr('y2', 1000)

      const hiddenClusters = g.selectAll('g rect')
        .data(coCluster.colClusters, (clst, i) => Array.isArray(clst) ? (String(clst.length) + String(i)) : this.id); // matching function

      const selectCluster = function (clst, i) {
        if (!clusterSelected[i]){
          clusterSelected[i] = 1;
          d3.select(this).select('rect').classed('cluster-selected', true);
          d3.select(this).property('selected', 'true');
          self.redraw_word_link(i)
          graph.link_info[i].forEach((l) => {d3.select(l['el']).classed('active', true);})
        } else {
          clusterSelected[i] = 0;
        }
      }

      const hGroups = hiddenClusters.enter()
        .append('g')
        .on('mouseover', function (clst, i) {
          if (clusterSelected[i]) return;
          // const selectedIdx = clusterSelected.indexOf(1);
          d3.select(this).select('rect').classed('cluster-selected', true);
          graph.link_info[i].forEach((l) => {d3.select(l['el']).classed('active', true);})
        })
        .on('mouseleave', function(clst, i) {
          if (clusterSelected[i]) return;
          if (d3.select(this).property('selected') === 'true') {
            d3.select(this).property('selected', 'false');
            self.redraw_word_link(-1);
          }
          d3.select(this).select('rect').classed('cluster-selected', false);
          graph.link_info[i].forEach((l) => {d3.select(l['el']).classed('active', false);})
        })
        .on('click', selectCluster)
        .attr('id', (clst, i) => (String(clst.length) + String(i)));

      hGroups.each(function (d, i) {
        graph.state_info.state_cluster_info[i]['el'] = this;
      });

      const clusterRect = hGroups.append('rect')
        .classed('hidden-cluster', true)
        .transition()
        .duration(400)
        .attr('width', (clst, i) => state_info.state_cluster_info[i].width)
        .attr('height', (clst, i) => state_info.state_cluster_info[i].height)
        .attr('x', (clst, i) => state_info.state_cluster_info[i].top_left[0])
        .attr('y', (clst, i) => state_info.state_cluster_info[i].top_left[1]);

      hGroups.append('path')
        .classed('little-triangle', true)
        .attr('d', 'M 0, 0 L ' + -littleTriangleWidth/2 + ', ' +
          littleTriangleHeight + ' L ' +  littleTriangleWidth/2 +
          ', ' + littleTriangleHeight + ' L 0, 0')
        .transition()
        .duration(400)
        .attr('transform', (k, i) => {
          return 'translate(' + [state_info.state_cluster_info[i].top_left[0] + state_info.state_cluster_info[i].width / 2,
            state_info.state_cluster_info[i].top_left[1] + state_info.state_cluster_info[i].height] + ')';
        });

      const units = hGroups.append('g')
        .selectAll('rect')
        .data(d => d);

      let tmp_units = units.enter()
        .append('rect')
        .on('mouseover', function(d, i) {
          if (d3.select(this.parentNode.parentNode).property('selected') === 'true') {
            d3.select(this).attr('fill-opacity', 1)
            console.log(d + 'is selected');
            // fisheye in
          }
        })
        .on('mouseleave', function(d, i) {
          if (d3.select(this.parentNode.parentNode).property('selected') === 'true') {
            d3.select(this).attr('fill-opacity', 0.5)
            console.log(d + 'is deselected');
            // fisheye out
          }
        })
        .transition()
        .duration(400)
        .attr('width', (i) => state_info.state_info[i].width)
        .attr('height', (i) => state_info.state_info[i].height)
        .attr('x', (i) => state_info.state_info[i].top_left[0])
        .attr('y', (i) => state_info.state_info[i].top_left[1])
        .attr('fill', self.unitNormalColor)
        .attr('fill-opacity', 0.5)

      tmp_units.each(function(d) {
        graph.state_info.state_info[d]['el'] = this;
      })


      // add
      hiddenClusters.exit()
        .transition()
        .duration(400)
        .style('fill-opacity', 1e-6)
        .attr('width', 1)
        .attr('height', 1)
        .remove();
    }

    sum(arr) {
      return arr.reduce(function (acc, val) {
        return acc + val;
      }, 0);
    }

    draw_word(g, graph) {
      let self = this;
      let word_info = graph.word_info;
      word_info.forEach((wclst, i) => {
        if (wclst['wordCloud']) {
          wclst['wordCloud']
            .draw([wclst.width/2, wclst.height/2])
            .transform( 'translate(' + [wclst.top_left[0] + wclst.width/2, wclst.top_left[1] + wclst.height/2] + ')')
        } else {
          let tmp_g = g.append('g')
            .on('mouseover', function () {
              self.graph.link_info.forEach((ls) => {
                d3.select(ls[i]['el'])
                  .classed('active', true);
              })
            })
            .on('mouseleave', function () {
              self.graph.link_info.forEach((ls) => {
                d3.select(ls[i]['el'])
                  .classed('active', false);
              })
            })
          let myWordCloud = new WordCloud(tmp_g, wclst.width/2, wclst.height/2, 'rect', this.compare)
            .transform( 'translate(' + [wclst.top_left[0] + wclst.width/2, wclst.top_left[1] + wclst.height/2] + ')')
          myWordCloud.update(word_info[i].words_data);

          // wclst['el'] = tmp_g.node();
          wclst['wordCloud'] = myWordCloud;
        }

      });
    }

    erase_link() {
      return;
      this.graph.link_info.forEach((ls) => {
        ls.forEach((l) => {
          d3.select(l['el'])
          .transition()
          .duration(500)
          .attr('opacity', 1e-6)
          .remove()
        });
      });
    }

    erase_word () {
      return;
      this.graph.word_info.forEach((w) => {
        d3.select(w['el'])
          .transition()
          .duration(500)
          .attr('fill-opacity', 1e-6)
          .remove()
      });
    }

    erase_state() {
      this.graph.state_info.state_cluster_info.forEach((s) => {
        d3.select(s['el'])
          .transition()
          .duration(500)
          .attr('fill-opacity', 1e-6)
          .attr('opacity', 1e-6)
          .remove()
      });
    }

    createLink(d) {
        return "M" + d.source.x + "," + d.source.y
            + "C" + (d.source.x + d.target.x) / 2 + "," + d.source.y
            + " " + (d.source.x + d.target.x) / 2 + "," + d.target.y
            + " " + d.target.x + "," + d.target.y;
      }

    draw_link(g, graph) {
      const link_info = graph.link_info;
      const linkWidth2StrengthRatio = this.params.linkWidth2StrengthRatio;
      // function link(d) {
      //   return "M" + d.source.x + "," + d.source.y
      //       + "C" + (d.source.x + d.target.x) / 2 + "," + d.source.y
      //       + " " + (d.source.x + d.target.x) / 2 + "," + d.target.y
      //       + " " + d.target.x + "," + d.target.y;
      // }

      function flatten(arr) {
        return arr.reduce((acc, val) => {
          return acc.concat(Array.isArray(val) ? flatten(val) : val);
        }, []);
      }

      const strengthes = flatten(link_info).filter(d => {return d.strength > 0}).map(d => {return Math.abs(d.strength)});
      // console.log(flatten(link_info));
      // console.log(flatten(link_info).filter(d => {return d.length > 0}));
      // console.log('strength is ');
      // console.log(strengthes);

      const scale = d3.scaleLinear()
        .domain(d3.extent(strengthes))
        .range(this.linkWidthRanage)

      link_info.forEach((ls, i) => {
        // const strengthRange = d3.extent(ls);
        ls.forEach((l, j) => {
          if (l['el']) {
            d3.select(l['el'])
              .transition()
              .duration(300)
              .attr('d', this.createLink(l))
          } else {
            let tmp_path = g.append('path')
              .classed('link', true)
              .classed('active', false)
              .attr('d', this.createLink(l))
              .attr('stroke-width', l.strength !== 0 ? scale(Math.abs(l.strength)) : 0)
              .attr('opacity', 0.2)
              .attr('stroke', l.strength > 0 ? this.linkColor[1] : this.linkColor[0])
            l['el'] = tmp_path.node();
          }

        });
      });
    }

    draw(coCluster) {
      let self = this;
      // console.log(coCluster.colClusters);
      const maxClusterSize = coCluster.colClusters.reduce((a, b) => Math.max(Array.isArray(a) ? a.length : a, b.length));
      // console.log(maxClusterSize);
      this.params.packNum = maxClusterSize > 60 ? Math.round(maxClusterSize / 40) : 2;
      const clusterHeight = this.params.clusterHeight;
      const nCluster = coCluster.labels.length;
      this.params.clusterInterval = (this.client_height / nCluster - clusterHeight) * 0.7;
      const clusterInterval = this.params.clusterInterval;
      let chordLength = nCluster * (clusterHeight + clusterInterval);
      this.dx = 0, this.dy = chordLength / 2;
      const coClusterAggregation = coCluster.aggregation_info;
      let state_info = this.calculate_state_info(coCluster);

      // let word_info = this.calculate_word_info(coCluster);
      // let link_info = this.calculate_link_info(state_info, word_info, coCluster, this.dx, this.dy);
      self.graph = {
        state_info: state_info,
        // word_info: word_info,
        // link_info: link_info,
        coCluster: coCluster,
      }
      // }
      this.draw_state(this.hg, self.graph);

      this.redraw_word_link();
      // this.adjustdx(-10);

      this.translateX(0);
    }

    translateX(x) {
      this.middle_line_x += x;
      this.hg.attr('transform', 'translate(' + [this.middle_line_x, 50] + ')');
      this.wg.attr('transform', 'translate(' + [this.middle_line_x + this.dx, 50 + this.dy] + ')');
    }

    adjustdx(newdx) {
      this.dx = newdx;
      this.redraw_word_link();
    }

    destroy() {
      if (!this.graph) {
        return;
      }
      this.erase_state();
      this.erase_link();
      this.erase_word();
      // self.graph.state_info.forEach(())
    }
  }

</script>

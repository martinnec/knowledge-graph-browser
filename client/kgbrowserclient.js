var cy;
var detail = document.getElementById('detail');
/*var layoutOptions =  {
	name: 'euler',
  springLength: edge => 240,
	randomize: true,
	animate: true
};*/
var startingLayoutOptions = {
  name: 'concentric'  
}
var layoutOptions = {
  name: 'cola',
  maxSimulationTime: 30000,
  fit: false,
  infinite: false,
  handleDisconnected: false  
}
var config = 'https://linked.opendata.cz/resource/knowledge-graph-browser/configuration/rpp';
var styles = [];
var layout ;

/*var graphP = $.ajax({
  url: 'http://localhost:3000/expand?view=https://linked.opendata.cz/resource/knowledge-graph-browser/view/rpp/struktura-agendy&resource=https://rpp-opendata.egon.gov.cz/odrpp/zdroj/agenda/A1081',
  // url: './data.json',
  type: 'GET',
  dataType: 'json'
});

Promise.all([ graphP ]).then(initCy);*/

initCy();

function initCy( then ) {
  
  let stylesP = $.ajax({
    url: 'http://localhost:3000/stylesheet?stylesheet=https://linked.opendata.cz/resource/knowledge-graph-browser/rpp/style-sheet',
    // url: './data.json',
    type: 'GET',
    dataType: 'json'
  });
  
  stylesP.then(function() {
    
    stylesP.responseJSON.styles.forEach(function(style) {
      styles.push({
        selector: style.selector,
        style: style.properties
      });
    });
    
    cy = cytoscape({

      container: document.getElementById('cy'), // container to render in
      
      style: styles,
    
      elements: []
                                                    
    });
    
    /*cy.on('tap', 'node', function(evt){
      
    });*/
    
    var doubleClickDelayMs = 350;
    var previousTapStamp = 0;
    
    cy.on('tap', 'node', function(e) {
      let currentTapStamp = e.timeStamp;
      let msFromLastTap = currentTapStamp - previousTapStamp;
      previousTapStamp = currentTapStamp;
      let node = e.target;
      let nodeIRI = node.data('id');
      let nodeViewSetsPromise = $.ajax({
        url: 'http://localhost:3000/view-sets?config='+ config + '&resource=' + nodeIRI,
        type: 'GET',
        dataType: 'json'
      });    
      if (msFromLastTap < doubleClickDelayMs) {
        nodeViewSetsPromise.then(function() {
          let viewIRI = nodeViewSetsPromise.responseJSON.viewSets[0].defaultView;
          expand(viewIRI, node);
        });
      } else {
        nodeViewSetsPromise.then(function() {
          if(node && node.isNode() && node.locked()) {
            node.unlock();
          }
          let viewIRI = nodeViewSetsPromise.responseJSON.viewSets[0].defaultView;
          showDetail(viewIRI, node);
        });
      }
      console.log("POSITION: " + node.position('x') + "," + node.position('y'));
    });

    
    cy.on('dragfree', 'node', function(evt){
      let node = evt.target;
      if(node && node.isNode()) {
        node.lock();
        layout.run();
      }
    });
    
    /*cy.on('position', 'node', function(evt){
      let node = evt.target;
      if(node && node.isNode() && node.data('id') == 'https://rpp-opendata.egon.gov.cz/odrpp/zdroj/činnost/A1081/CR6229') {
        console.log("POSITION: " + node.position('x') + "," + node.position('y'));  
      }
    });*/


    /*cy.on('layoutstart', function(evt){
      console.log("LAYOUT START");
    });*/
    
    /*cy.on('layoutstop', function(evt){
      console.log("LAYOUT STOP");
    });*/

    preview('https://linked.opendata.cz/resource/knowledge-graph-browser/view/rpp/struktura-agendy', 'https://rpp-opendata.egon.gov.cz/odrpp/zdroj/agenda/A1081');    
  });
  
}

function preview(view, resource) {

  console.log('PREVIEW: http://localhost:3000/preview?view='+ view + '&resource=' + resource);
  let graphP = $.ajax({
    url: 'http://localhost:3000/preview?view='+ view + '&resource=' + resource,
    type: 'GET',
    dataType: 'json'
  });
  
  graphP.then(function()  {
    let node = graphP.responseJSON.nodes[0];
    cy.add({
      group: 'nodes',
      data: {
        id: node.iri,
        label: node.label.substring(0,24),
        fullLabel: node.label,
        type: node.type 
      },
      classes: node.classes
    });
    layout = cy.layout(startingLayoutOptions);
    layout.run();
  });
}

function showDetail(view, node) {

  let resource = node.data('id');
  
  console.log('DETAIL: http://localhost:3000/detail?view='+ view + '&resource=' + resource);
  let graphP = $.ajax({
    url: 'http://localhost:3000/detail?view='+ view + '&resource=' + resource,
    type: 'GET',
    dataType: 'json'
  });
  
  graphP.then(function()  {
    let detailJson = graphP.responseJSON.nodes[0];
    let typesJson = graphP.responseJSON.types;
    let typesMap = new Map();    
    for(let i in typesJson) {
      typesMap.set(typesJson[i].iri, typesJson[i]);
    }

    let html = "<div><a href=\"" + detailJson.iri + "\">" + node.data('fullLabel') + "</a></div>"; 
    
    html += "<table>";
    for(let property in detailJson.data)  {
      let propertyJson = typesMap.get(property);
      if(propertyJson)  {
        html += "<tr><td><a href=\"" + property + "\">" + propertyJson.label + "</a></td><td>" + detailJson.data[property] + "</td></tr>";
      } else {
        html += "<tr><td>" + property + "</td><td>" + detailJson.data[property] + "</td></tr>";
      }  
    }
    html += "</table>";
    
    detail.innerHTML = html;

  });
}

function expand(view, node) {

  let resource = node.data('id');

  console.log('EXPAND: http://localhost:3000/expand?view='+ view + '&resource=' + resource);
  let graphP = $.ajax({
    url: 'http://localhost:3000/expand?view='+ view + '&resource=' + resource,
    type: 'GET',
    dataType: 'json'
  });
  
  let elements = [];
  
  Promise.all([ graphP ]).then(function() {
    graphP.responseJSON.nodes.forEach(function(nodeJSON) {
      let nodeElement = {
        group: 'nodes',
        data: {
          id: nodeJSON.iri,
          label: nodeJSON.label.substring(0,24),
          fullLabel: nodeJSON.label,
          type: nodeJSON.type
        },
        classes: nodeJSON.classes,
        position: {
          x: node.position('x')+50,
          y: node.position('y')+50
        }
      }
      elements.push(nodeElement);
    });
  }).then(function()  {
    graphP.responseJSON.edges.forEach(function(edge) {
      elements.push({
        groups: 'edges',
        data: {
          source: edge.source,
          target: edge.target
        }
      });
    });
  }).then(function()  {
    cy.add(elements);
    cy.style().fromJson(styles);
    layout = cy.layout(layoutOptions);
    layout.run();
  });
}
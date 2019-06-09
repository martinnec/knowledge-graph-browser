var cy;
/*var layoutOptions =  {
	name: 'euler',
  springLength: edge => 160,
	randomize: true,
	animate: true
};*/
var layoutOptions = {
  name: 'cola',
  maxSimulationTime: 8000
}
var config = 'https://linked.opendata.cz/resource/knowledge-graph-browser/configuration/rpp';
var styles = [];

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
    
    cy.on('tap', 'node', function(evt){
      let node = evt.target;
      let nodeIRI = node.data('id');
      let nodeViewSetsPromise = $.ajax({
        url: 'http://localhost:3000/view-sets?config='+ config + '&resource=' + nodeIRI,
        type: 'GET',
        dataType: 'json'
      });
      nodeViewSetsPromise.then(function() {
        let viewIRI = nodeViewSetsPromise.responseJSON.viewSets[0].defaultView;
        expand(viewIRI, nodeIRI);
      });
    });

    preview('https://linked.opendata.cz/resource/knowledge-graph-browser/view/rpp/struktura-agendy', 'https://rpp-opendata.egon.gov.cz/odrpp/zdroj/agenda/A1081');    
    expand('https://linked.opendata.cz/resource/knowledge-graph-browser/view/rpp/struktura-agendy', 'https://rpp-opendata.egon.gov.cz/odrpp/zdroj/agenda/A1081');
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
        label: node.label.substring(0,32),
        type: node.type 
      }
    });
    cy.elements().layout(layoutOptions).run();
  });
}

function expand(view, resource) {

  console.log('EXPAND: http://localhost:3000/expand?view='+ view + '&resource=' + resource);
  let graphP = $.ajax({
    url: 'http://localhost:3000/expand?view='+ view + '&resource=' + resource,
    type: 'GET',
    dataType: 'json'
  });
  
  let elements = [];
  
  Promise.all([ graphP ]).then(function() {
    graphP.responseJSON.nodes.forEach(function(node) {
      elements.push({
        group: 'nodes',
        data: {
          id: node.iri,
          label: node.label.substring(0,32),
          type: node.type 
        }
      });
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
  }).then(function() {
    console.log(cy.elements().jsons());
    cy.style().fromJson(styles);
    console.log(cy.style().json());
    cy.elements().layout(layoutOptions).run();
  });
}
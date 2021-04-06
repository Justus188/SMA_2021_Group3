// Var definitions
var WINDOWBORDERSIZE = 10;
var HUGE = 999999; //Sometimes useful when testing for big or small numbers
var animationDelay = 200; //controls simulation and transition speed; steps once every animationDelay ms
var isRunning = false; // used in simStep and toggleSimStep
var surface; // Set in the redrawWindow function. It is the D3 selection of the svg drawing surface
var simTimer; // Set in the initialization function

// TODO: Change urls
const urlCustomer = [0,
	"images/1_Customer.png",
	"images/2_Customer.png",
	"images/3_Customer.png",
	"images/4_Customer.png",
	"images/5_Customer.png",
	"images/6_Customer.png",
	"images/7_Customer.png",
	"images/8_Customer.png"];
const urlTable = [0, 0,
	"images/2_Table.png",
	"images/3_Table.png",
	"images/4_Table.png", 0, 0, 0,
	"images/8_Table.png"];
const urlDoor = "images/Exit_Door.png";
const urlQR = "images/Staff.png";

const OUTSIDE		=0;
const SHOPPING		=1;
const STAGING		=2; 
const INRESTAURANT 	=3;
//const ORDERING    =4;
//const EATING      =5;
const LEAVING 		=7;
const EXITED  	   	=8;
const DROPOUT 	   	=9;

// for table / Cashier status
const IDLE = 0;
const BUSY = 1;

const MAX_STAGING = 20;
const EATING_AREA_SIZE = 15;
var STAGING_SIZE = MAX_STAGING
var STAGING_SPOT = new Array(20).fill(0)

const QR = 0;
const QRLocation = {"row": 2, "col": 20};
const EXIT = 9;
const ExitLocation = {"row": 6+EATING_AREA_SIZE+1,"col": 20};

var nextCustomerId = 0;

var customers = [];
var staff = [
	{"type":QR, "label":"QR", "location": QRLocation},
	{"type":EXIT, "label":"Exit", "location": ExitLocation}
]

//The drawing surface will be divided into logical cells
var maxCols = 40;
var cellWidth; //cellWidth is calculated in the redrawWindow function
var cellHeight; //cellHeight is calculated in the redrawWindow function

var areas = [
	{"label":"Virtual Queue", "startRow":1, "numRows":1, "startCol": 11, "numCols": STAGING_SIZE, "color":"pink"},
	{"label":"Staging Area", "startRow":4, "numRows":1, "startCol": 11, "numCols": STAGING_SIZE, "color":"red"},
	{"label":"Eating Area", "startRow":6, "numRows":EATING_AREA_SIZE, "startCol": 11, "numCols": 20, "color":"yellow"}
];

const numTables = [
	{"pax": 2, "numTables": 3},
	{"pax": 3, "numTables": 15},
	{"pax": 4, "numTables": 75},
	{"pax": 8, "numTables": 19}
];
function pax_maker (i){
	if (i < 3) {return 2} else if (i < 3+15) {return 3} else if (i < 3+15+75) {return 4} 
	else if (i < 3+15+75+19) {return 8} else {return 0}
};
var tables = Array.apply(null, {length: numTables.reduce((a,b) => a + b['numTables'],0)}).map(
	function(d,i){return {"row": 6+Math.floor(i/10), "col": 11+ (i%10)*2, "state": IDLE, "pax": pax_maker(i)}})

var currentTime = 0;
var stats = [
	{"name":"Mean Waiting Time: ", "location":{"row":6+EATING_AREA_SIZE+4, "col": 11}, "cumulativeValue":0, "count":0},
	{"name":"Mean Idle Tables: ",  "location":{"row":6+EATING_AREA_SIZE+5, "col": 11}, "cumulativeValue":0, "count":0},
	{"name":"Mean Turnover: ", "location":{"row":6+EATING_AREA_SIZE+6, "col": 11}, "cumulativeValue":0, "count":0},
	{"name":"Mean Dropout: ", "location":{"row":6+EATING_AREA_SIZE+7, "col": 11}, "cumulativeValue":0, "count":0}
];

// From collecting our own data onsite at Ikea Restaurant,
const paxprob = [0.07, 0.57, 0.23, 0.07, 0.04, 0.01, 0.0075, 0.0025];
const paxcdf = [];
paxprob.reduce(function(a,b,i) { return paxcdf[i] = a+b; },0);
const probArrival = 0.35;




// Actual functions
(function() {
	// Your page initialization code goes here
	// All elements of the DOM will be available here
	window.addEventListener("resize", redrawWindow); //Redraw whenever the window is resized
	simTimer = window.setInterval(simStep, animationDelay); // call the function simStep every animationDelay milliseconds
	redrawWindow();
})();

function toggleSimStep(){ 
	//this function is called by a click event on the html page. 
	// Search BasicAgentModel.html to find where it is called.
	isRunning = !isRunning;
	console.log("isRunning: "+isRunning);
}
	
function redrawWindow(){
	isRunning = false; // used by simStep
	window.clearInterval(simTimer); // clear the Timer
	animationDelay = 550 - document.getElementById("slider1").value;
	simTimer = window.setInterval(simStep, animationDelay); // call the function simStep every animationDelay milliseconds
	
	// Re-initialize simulation variables
	
	currentTime = 0;
	nextCustomerId = 0;
	stats.map(function(d){d.count=0; d.cumulativeValue=0;})
	customers = [];
	
	//resize the drawing surface; remove all its contents; 
	var drawsurface = document.getElementById("surface");
	var creditselement = document.getElementById("credits");
	var w = window.innerWidth;
	var h = window.innerHeight;
	var surfaceWidth =(w - 3*WINDOWBORDERSIZE);
	var surfaceHeight= (h-creditselement.offsetHeight - 3*WINDOWBORDERSIZE);
	
	drawsurface.style.width = surfaceWidth+"px";
	drawsurface.style.height = surfaceHeight+"px";
	drawsurface.style.left = WINDOWBORDERSIZE/2+'px';
	drawsurface.style.top = WINDOWBORDERSIZE/2+'px';
	drawsurface.style.border = "thick solid #0000FF"; //The border is mainly for debugging; okay to remove it
	drawsurface.innerHTML = ''; //This empties the contents of the drawing surface, like jQuery erase().
	
	// Compute the cellWidth and cellHeight, given the size of the drawing surface
	numCols = maxCols;
	cellWidth = surfaceWidth/numCols;
	numRows = Math.ceil(surfaceHeight/cellWidth);
	cellHeight = surfaceHeight/numRows;
	
	// In other functions we will access the drawing surface using the d3 library. 
	//Here we set the global variable, surface, equal to the d3 selection of the drawing surface
	surface = d3.select('#surface');
	surface.selectAll('*').remove(); // we added this because setting the inner html to blank may not remove all svg elements
	surface.style("font-size","100%");
	// rebuild contents of the drawing surface
	updateSurface();	
};
	
// The window is resizable, so we need to translate row and column coordinates into screen coordinates x and y
function getLocationCell(location){
	var row = location.row;
	var col = location.col;
	var x = (col-1)*cellWidth; //cellWidth is set in the redrawWindow function
	var y = (row-1)*cellHeight; //cellHeight is set in the redrawWindow function
	return {"x":x,"y":y};
}
	
function updateSurface() {
	var allCustomers = surface.selectAll(".customer").data(customers);
	allCustomers.exit().remove() // remove excess elements
	
	//Images for all entitytypes
	
	var newCustomers = allCustomers.enter().append("g").attr("class", "customer");
	newCustomers.append("svg:image")
	 .attr("x",function(d){var cell= getLocationCell(d.location); return cell.x+"px";})
	 .attr("y",function(d){var cell= getLocationCell(d.location); return cell.y+"px";})
	 .attr("width", Math.min(cellWidth,cellHeight)+"px")
	 .attr("height", Math.min(cellWidth,cellHeight)+"px")
	 .attr("xlink:href", d => urlCustomer[d.pax]);
	
	//Moving customers
	var images = allCustomers.selectAll("image");
	images.transition()
	 .attr("x",function(d){var cell= getLocationCell(d.location); return cell.x+"px";})
	 .attr("y",function(d){var cell= getLocationCell(d.location); return cell.y+"px";})
	 .duration(animationDelay).ease('linear');
	
	var allStaff = surface.selectAll(".staff").data(staff);
	var newStaff = allStaff.enter().append("g").attr("class", "staff");
	newStaff.append("svg:image")
	 .attr("x",function(d){var cell= getLocationCell(d.location); return cell.x+"px";})
	 .attr("y",function(d){var cell= getLocationCell(d.location); return cell.y+"px";})
	 .attr("width", Math.min(cellWidth,cellHeight)+"px")
	 .attr("height", Math.min(cellWidth,cellHeight)+"px")
	 .attr("xlink:href", urlQR); // Change if you add more staff
	
	newStaff.append("text")
    .attr("x", function(d) { var cell= getLocationCell(d.location); return (cell.x+cellWidth)+"px"; })
    .attr("y", function(d) { var cell= getLocationCell(d.location); return (cell.y+cellHeight/2)+"px"; })
    .attr("dy", ".35em")
    .text(function(d) { return d.label; });
	
	var allStats = surface.selectAll(".stats").data(stats);
	var newStats = allStats.enter().append("g").attr("class", "stats");
	newStats.append("text")
	.attr("x", function(d) { var cell= getLocationCell(d.location); return (cell.x+cellWidth)+"px"; })
    .attr("y", function(d) { var cell= getLocationCell(d.location); return (cell.y+cellHeight/2)+"px"; })
    .attr("dy", ".35em")
    .text(""); 
	
	allStats.selectAll("text").text(function(d){
		var display = d.cumulativeValue / (Math.max(1, d.count));
		return d.name + display.toFixed(1);
	});
	
	// Boxes around areas
	var allAreas = surface.selectAll(".areas").data(areas);
	var newAreas = allAreas.enter().append("g").attr("class","areas");
	newAreas.append("rect")
	.attr("x", function(d){return (d.startCol-1)*cellWidth;})
	.attr("y",  function(d){return (d.startRow-1)*cellHeight;})
	.attr("width",  function(d){return d.numCols*cellWidth;})
	.attr("height",  function(d){return d.numRows*cellWidth;})
	.style("fill", function(d) { return d.color; })
	.style("stroke","black")
	.style("stroke-width",1);
	
	var allTables = surface.selectAll(".table").data(tables);
	var newTables = allTables.enter().append("g").attr("class", "waitingSeats");
	newTables.append("svg:image")
	 .attr("x",function(d){return (d.col-1)*cellWidth;})
	 .attr("y",function(d){return (d.row-1)*cellHeight;})
	 .attr("width", cellWidth)
	 .attr("height", cellWidth)
	 .attr("xlink:href", d => urlTable[d.pax]);
}
		
function addDynamicAgents(){
	// Customers are dynamic
	if (Math.random()< probArrival){
		var newCustomer = {"id":++nextCustomerId, "location":{"row":1,"col":1},
		"target":{"row": 2, "col": 20},"state":OUTSIDE,"timeQR":0, "timeEnter":0, "timeLeave":0};
		const randint = Math.random();
		newCustomer.pax = paxcdf.findIndex(function(number) {return number > randint;}) + 1; //JS starts from 0
		customers.push(newCustomer);
	}
}

function updateCustomer(customerId){
	customerId = Number(customerId);
	var customer = customers[customerId];
	var row = customer.location.row;
	var col = customer.location.col;
	var pax = customer.pax;
	var state = customer.state;
	
	var hasArrived = (Math.abs(customer.target.row-row)+Math.abs(customer.target.col-col))==0;
	function randomInteger(min, max) {
  		return Math.floor(Math.random() * (max - min + 1)) + min};
	
	switch(state){
		case OUTSIDE://Rae
			if (hasArrived) {	
				customer.target.row = randomInteger(areas[0].startRow, (areas[0].startRow + areas[0].numRows -1));
				customer.target.col = randomInteger(areas[0].startCol, (areas[0].startCol + areas[0].numCols -1));
				customer.state = SHOPPING;
				customer.timeQR = currentTime;
				stats[2].count += 1;
			}
		break;
		case SHOPPING: //Rae
			if (hasArrived) {
				var i = 0;
				while (i<20 && STAGING_SPOT[i]==1){
					i = i + 1}
				customer.target.col = i + 11;
				customer.target.row = areas[1].startRow;
				customer.state = STAGING;
				STAGING_SPOT[i]=1;
			}
		break;
		case STAGING: // Moktar
			if(hasArrived){
				//customer is staged infront of the restaurant
				var customerposition = customer.location.col-11;
				var customer_table = tables.find(function(d){return d.state==IDLE && d.pax >= customer.pax});
				if (customer_table !== undefined){	
					//if there is an idle table with the corresponding pax size 
					//as the customers in the staging area, they will get access into 
					//the restaurant
					customer_table.state = BUSY;
					customer.state= INRESTAURANT;
					customer.target.row= customer_table.row;
					customer.target.col= customer_table.col;
					customer.timeEnter = currentTime;
					customer.timeLeave = currentTime + 1000
					STAGING_SPOT[customerposition]=0;
				} else if( STAGING_SPOT[customerposition-1]==0){  
					customer.target.col=customerposition-1;
					customer.target.row=areas[1].startRow;
					STAGING_SPOT[customerposition]=0
					STAGING_SPOT[customerposition-1]=1
				}
			}
		break;
		case INRESTAURANT: // HL
			if(currentTime > customer.timeLeave && hasArrived){
				customer.state = LEAVING;
				customer.target = ExitLocation;
				tables.find(d => (d.row == row && d.col == col)).state = IDLE;
			}
		break;
		case LEAVING:
			if(hasArrived){
				customer.state = EXITED;
			}
		default:
		break;
	}
	
	// set the destination row and column
	var targetRow = customer.target.row;
	var targetCol = customer.target.col;
	// compute the distance to the target destination
	var rowsToGo = targetRow - row;
	var colsToGo = targetCol - col;
	// set the speed
	var cellsPerStep = 1; //LOOK AT THIS LATER
	// compute the cell to move to
	var newRow = row + Math.min(Math.abs(rowsToGo),cellsPerStep)*Math.sign(rowsToGo);
	var newCol = col + Math.min(Math.abs(colsToGo),cellsPerStep)*Math.sign(colsToGo);
	// update the location of the patient
	customer.location.row = newRow;
	customer.location.col = newCol;
}
	
function removeDynamicAgents() {
	var allCustomers = surface.selectAll(".customer").data(customers);
  	var goneCustomers = allCustomers.filter(function(d,i){return d.state >=EXITED;});
	goneCustomers.remove();
	customers = customers.filter(function(d){return d.state < EXITED;});
}
	
function updateDynamicAgents(){
	for (var customerId in customers){
		updateCustomer(customerId);
	}
	updateSurface();
}
	
function simStep(){
	//This function is called by a timer; if running, it executes one simulation step 
	//The timing interval is set in the page initialization function near the top of this file
	if (isRunning){ //the isRunning variable is toggled by toggleSimStep
		// Increment current time (for computing statistics)
		currentTime++;
		// Sometimes new agents will be created in the following function
		addDynamicAgents();
		// In the next function we update each agent
		updateDynamicAgents();
		// Sometimes agents will be removed in the following function
		removeDynamicAgents();
	}
}

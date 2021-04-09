// Var definitions
var WINDOWBORDERSIZE = 10;
var HUGE = 999999; //Sometimes useful when testing for big or small numbers
var animationDelay = 1000/60; //controls simulation and transition speed; steps once every animationDelay ms
var isRunning = false; // used in simStep and toggleSimStep
var surface; // Set in the redrawWindow function. It is the D3 selection of the svg drawing surface
var simTimer; // Set in the initialization function
var isStaging = false; // Set in toggleStaging

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
const EATING_AREA_SIZE = 13;
const STAGING_SIZE = MAX_STAGING;
var STAGING_SPOT = new Array(20).fill(0);
//var STAGING_VISUALIZER = new Array(20).fill(-1);
Object.seal(STAGING_SPOT)
//Object.seal(STAGING_VISUALIZER);

const QR = 0;
const QRLocation = {"row": 2, "col": 20};
const EXIT = 9;
const ExitLocation = {"row": 6+EATING_AREA_SIZE+1,"col": 20};

var nextCustomerId = 0;

var customers = [];
var staff = [
	{"type":QR, "label":"QR", "location": QRLocation},
	{"type":EXIT, "label":"Exit", "location": ExitLocation}
];

//The drawing surface will be divided into logical cells
const maxCols = 40;
var cellWidth; //cellWidth is calculated in the redrawWindow function
var cellHeight; //cellHeight is calculated in the redrawWindow function

var areas = [
	{"label":"Virtual Queue", "startRow":1, "numRows":1, "startCol": 11, "numCols": STAGING_SIZE, "color":"pink"},
	{"label":"Eating Area", "startRow":6, "numRows":EATING_AREA_SIZE, "startCol": 11, "numCols": 20, "color":"yellow"}
];

const numTables = [
	{"pax": 2, "numTables": 3},
	{"pax": 3, "numTables": 15},
	{"pax": 4, "numTables": 75},
	{"pax": 8, "numTables": 19}
];
function table_pax_maker (i){
	if (i < 3) {return 2} else if (i < 3+15) {return 3} else if (i < 3+15+75) {return 4} 
	else if (i < 3+15+75+19) {return 8} else {return 0}
};
var tables = Array.apply(null, {length: numTables.reduce((a,b) => a + b['numTables'],0)}).map(
	function(d,i){return {"row": 6+Math.floor(i/10), "col": 11+ (i%10)*2, "state": IDLE, "pax": table_pax_maker(i)}})

console.log(tables);

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
const probArrival = 1;//03371734; // mean interarrival measured to be 29.15
//We assume arrivals to follow Poisson Process, which is memoryless
//pexp(1, 29.15) = prob Arrival per s
const serviceTime = 300; // Placeholder serviceTime for testing



// Random Generators and Variance Reduction
// To see if its possible
// seed = 123;
// var MersenneTwister = require('mersenne-twister');
// var RNGen = new MersenneTwister(seed);

function randomInteger(min, max) {return Math.floor(Math.random() * (max - min + 1)) + min};
	// For aesthetically placing customers in virtual queue - no effect on statistics at all

function getPax(){
	// To generate number of pax
	const randint = Math.random();
	const found = paxcdf.findIndex(element => element > randint) +1;
	return found;}
	
// var gaussian = require('gaussian') // Importing from gaussian.js
// var serviceTimeDist = gaussian(2704, 807^2);// Service Time measured to have mean 2704, sd 807
// We assume normal distribution of Service Time
// Usage notes: var serviceTimeSample = serviceTimeDist.ppf(Math.random())
// function genServiceTime() {return serviceTimeDist.ppf(Math.random())}

// var walkingTimeDist = gaussian(600,22500);
// We estimate time between receiving SMS and reaching the restaurant to be 10 min with standard deviation of 5min
// translated into seconds, 600,22500
// function genWalkingTime() {return walkingTimeDist.ppf(Math.random())} //Not implemented in main body yet



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
	//console.log("isRunning: "+isRunning);
}

function toggleStaging(){
	isStaging = !isStaging
	if(isStaging){
		areas = [
			{"label":"Virtual Queue", "startRow":1, "numRows":1, "startCol": 11, "numCols": STAGING_SIZE, "color":"pink"},
			{"label":"Staging Area", "startRow":4, "numRows":1, "startCol": 11, "numCols": STAGING_SIZE, "color":"red"},
			{"label":"Eating Area", "startRow":6, "numRows":EATING_AREA_SIZE, "startCol": 11, "numCols": 20, "color":"yellow"}
		];
	} else {
		areas = [
			{"label":"Virtual Queue", "startRow":1, "numRows":1, "startCol": 11, "numCols": STAGING_SIZE, "color":"pink"},
			{"label":"Eating Area", "startRow":6, "numRows":EATING_AREA_SIZE, "startCol": 11, "numCols": 20, "color":"yellow"}
		];
	}
	redrawWindow()
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
	tables.map(d => d.state = IDLE);
	STAGING_SPOT.fill(0);
	STAGING_VISUALIZER.fill(-1);
	
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
		newCustomer.pax = getPax();
		customers.push(newCustomer);
	}
}

function updateCustomer(customerId){
	customerId = Number(customerId);
	var customer = customers[customerId];
	customerId = customer["id"];
	var row = customer.location.row;
	var col = customer.location.col;
	var state = customer.state;
	var empty_table = tables.find(function(d){return d.state==IDLE && d.pax >= customer.pax});
	//console.log(`EMPTY_TABLE: ${empty_table}`);
	
	var hasArrived = (Math.abs(customer.target.row-customer.location.row)+Math.abs(customer.target.col-customer.location.col))==0;
	
	switch(state){
		case OUTSIDE:
			if (hasArrived) {
				//update state
				customer.state = SHOPPING;
				//update target
				customer.target.row = randomInteger(areas[0].startRow, (areas[0].startRow + areas[0].numRows -1));
				customer.target.col = randomInteger(areas[0].startCol, (areas[0].startCol + areas[0].numCols -1));
				//stats
				customer.timeQR = currentTime;
			}
		break;
		case SHOPPING:
			if(isStaging) {
				var empty_staging_spot = STAGING_SPOT.findIndex((d) => d===0)
				if (STAGING_SPOT.every((d) => d ==0) && empty_table !== undefined){
					//update state
					empty_table.state = BUSY;
					customer.state= INRESTAURANT;
					//update target
					customer.target.row= empty_table.row;
					customer.target.col= empty_table.col;
					//stats
					customer.timeEnter = currentTime;
					customer.timeLeave = currentTime + serviceTime;//genServiceTime();
					stats[0].cumulativeValue = customer.timeEnter - customer.timeQR;
					stats[0].count++;
				} else if (empty_staging_spot >= 0) {
					//update state
					STAGING_SPOT[empty_staging_spot]=1;
					//STAGING_VISUALIZER[empty_staging_spot]=customerId;
					customer.state = STAGING;
					//update target
					customer.target.col = empty_staging_spot + 11;
					customer.target.row = areas[1].startRow;
				}
			} else {
				if (empty_table !== undefined){	
					//update state
					empty_table.state = BUSY;
					customer.state= INRESTAURANT;
					//update target
					customer.target.row= empty_table.row;
					customer.target.col= empty_table.col;
					//stats
					customer.timeEnter = currentTime;
					customer.timeLeave = currentTime + serviceTime;//genServiceTime();
					stats[0].cumulativeValue = customer.timeEnter - customer.timeQR;
					stats[0].count++;
				}
			}
		break;
		case STAGING:
			var customerposition = customer.target.col-11;  
			if (empty_table !== undefined){	
				//update state
				//console.log(STAGING_SPOT)
				STAGING_SPOT[customerposition]=0;
				//STAGING_VISUALIZER[customerposition]=-1;
				//console.log(STAGING_SPOT)
				empty_table.state = BUSY;
				customer.state= INRESTAURANT;
				//update target
				customer.target.row= empty_table.row;
				customer.target.col= empty_table.col;
				//stats
				customer.timeEnter = currentTime;
				customer.timeLeave = currentTime + serviceTime;//genServiceTime();
				stats[0].cumulativeValue = customer.timeEnter - customer.timeQR;
				stats[0].count++;
			} else if(hasArrived && customerposition!==0 && STAGING_SPOT[customerposition-1]==0){
				//update state
				STAGING_SPOT[customerposition]=0;
				//STAGING_VISUALIZER[customerposition]=-1;
				STAGING_SPOT[customerposition-1]=1;
				//STAGING_VISUALIZER[customerposition-1]=customerId;
				//update target
				customer.target.col=customer.target.col-1;
			}
		break;
		case INRESTAURANT:
			if(currentTime > customer.timeLeave && hasArrived){
				//update state
				customer.state = LEAVING;
				tables.find(d => (d.row == customer.location.row && d.col == customer.location.col)).state = IDLE;
				//update target
				customer.target = ExitLocation;
			}
		break;
		case LEAVING:
			if(hasArrived){
				//byee
				customer.state = EXITED;
				stats[2].cumulativeValue += 1;
			}
		default:
		break;
	}
	if(!hasArrived){
		// set the destination row and column
		var targetRow = customer.target.row;
		var targetCol = customer.target.col;
		// compute the distance to the target destination
		var rowsToGo = targetRow - customer.location.row;
		var colsToGo = targetCol - customer.location.col;
		// set the speed
		var cellsPerStep = 1; //LOOK AT THIS LATER
		// compute the cell to move to
		var newRow = customer.location.row + Math.min(Math.abs(rowsToGo),cellsPerStep)*Math.sign(rowsToGo);
		var newCol = customer.location.col + Math.min(Math.abs(colsToGo),cellsPerStep)*Math.sign(colsToGo);
		// update the location of the patient
		customer.location.row = newRow;
		customer.location.col = newCol;
	}
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
	stats[1].cumulativeValue += 122 - tables.reduce((a,b) => a + b.state, 0); //Update Idle tables
	stats[1].count++; //tick time for idle tables
	stats[2].count++; 
	updateSurface();
}
	
function simStep(){
	//This function is called by a timer; if running, it executes one simulation step 
	//The timing interval is set in the page initialization function near the top of this file
	if (isRunning){ //the isRunning variable is toggled by toggleSimStep
		//console.log(`BEFORE ${currentTime}: ${STAGING_VISUALIZER}`);
		// Increment current time (for computing statistics)
		currentTime++;
		// Sometimes new agents will be created in the following function
		addDynamicAgents();
		// In the next function we update each agent
		updateDynamicAgents();
		// Sometimes agents will be removed in the following function
		removeDynamicAgents();
		//console.log(`AFTER ${currentTime}: ${STAGING_VISUALIZER}`);
	}
}

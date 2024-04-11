let worldSvg, plotSvg;

const ctx = {
    w: 1280,
    h: 720,
    country: {},
    // region: {}
};

let box_boolean = false;
let brush1,brush2;
let selectedCountry = [];


let coffeeQualityScore = ["Aroma","Flavor","Aftertaste","Acidity","Body","Balance","Uniformity","Clean Cup","Sweetness","Overall","Total"];
let colorScale = d3.scaleOrdinal(d3.schemeCategory10);
let coffeecolorScale;
function TransformData(data){
    //"ID","Species","Owner","Country.of.Origin","Farm.Name","Lot.Number","Mill","ICO.Number","Company","Altitude","Region","Producer","Number.of.Bags","Bag.Weight","In.Country.Partner","Harvest.Year","Grading.Date","Owner.1","Variety","Processing.Method","Aroma","Flavor","Aftertaste","Acidity","Body","Balance","Uniformity","Clean.Cup","Sweetness","Cupper.Points","Total.Cup.Points","Moisture","Category.One.Defects","Quakers","Color","Category.Two.Defects","Expiration","Certification.Body","Certification.Address","Certification.Contact","unit_of_measurement","altitude_low_meters","altitude_high_meters","altitude_mean_meters"
    data.forEach(d => d["Clean Cup"] = d["Clean.Cup"]);
    data.forEach(d => d["Total"] = d["Total.Cup.Points"]);
    data.forEach(d => d["Overall"] = d["Cupper.Points"]);
    
    //filter out the data which has a empty Country.of.Origin or Region
    data = data.filter(d => d["Country.of.Origin"] != "" && d["Region"] != "");
    //filter out the data which has a empty Total.Cup.Points
    data = data.filter(d => d["Total"] != 0);
    data = data.filter(d => d["Clean Cup"] != 0);
    console.log(data);
    let country = [...new Set(data.map(d => d["Country.of.Origin"]))];
    // let region = [...new Set(data.map(d => d["Region"]))];
    console.log(country);

    //use the country and region as key to group the data
    country.forEach(c => ctx.country[c] = data.filter(d => d["Country.of.Origin"] == c));
    // region.forEach(r => ctx.region[r] = data.filter(d => d["Region"] == r));

    //calculate the average coffee quality score
    country.forEach(c => {
        coffeeQualityScore.forEach(s => {
            //fixed the decimal to 4
        ctx.country[c][s] = d3.mean(ctx.country[c].map(d => +d[s])).toFixed(4);}
        );
    
    });
    
    console.log(ctx.country);

}
function createViz(){
    console.log("Using D3 v"+d3.version);

    loadData();
    
};

function drawMap(data){
    //get min and max from ctx.country
    let min = d3.min(Object.values(ctx.country).map(d => +d["Total"]));
    let max = d3.max(Object.values(ctx.country).map(d => +d["Total"]));
    console.log(min);
    console.log(max);
    coffeecolorScale = d3.scaleLinear()
        .domain([min, max])
        .range(["#e4d5b7", "#3B1C0A"]);
       
    worldSvg = d3.select("#world-map").append("svg")
        .attr("width", ctx.w)
        .attr("height", ctx.h);
    
    let projection = d3.geoMercator()
        .scale(200)
        .translate([ctx.w/2, ctx.h/1.5]);

    let path = d3.geoPath().projection(projection);
    let map = worldSvg.append("g");
    map.selectAll(".mappath")
        .data(data.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", d => ctx.country[d.properties.ADMIN] ? coffeecolorScale(ctx.country[d.properties.ADMIN]["Total"]) : "lightgray")
        .attr("stroke-width", 1)
        .attr("stroke", "lightgray")
        .on("click", function(event, d){
            
            if(!ctx.country[d.properties.ADMIN]) return;
            
            selectedCountry = [d.properties.ADMIN];
            updateVis();
            event.stopPropagation();

        }
        );

    //add tooltip
    worldSvg.selectAll("path").append("title")
        .text(d => ctx.country[d.properties.ADMIN] ? d.properties.ADMIN + "\nTotal Cup Point: " + ctx.country[d.properties.ADMIN]["Total"] : d.properties.ADMIN);

    //add legend on left bottom
    let legend = worldSvg.append("g")
        .attr("transform", "translate(20, 600)");
    let legendScale = d3.scaleLinear()
        .domain([min, max])
        .range([0, 200]);    
    legend.append("text")
        .attr("x", 0)
        .attr("y", 30)
        .text("Total Cup Points");
    legend.append("rect")
        .attr("x", 0)
        .attr("y", 40)
        .attr("width", 200)
        .attr("height", 20)
        .attr("fill", "url(#gradient)");
    legend.append("defs")
        .append("linearGradient")
        .attr("id", "gradient")
        .selectAll("stop")
        .data(coffeecolorScale.range())
        .enter()
        .append("stop")
        .attr("offset", (d, i) => i/(coffeecolorScale.range().length-1))
        .attr("stop-color", d => d);
    // add axis 
    let legendAxis = d3.axisBottom(legendScale)
        .ticks(5)
        .tickFormat(d => d);
    legend.append("g")
        .attr("transform", "translate(0, 60)")
        .call(legendAxis)
        .select(".domain")
        .remove();
    
    

    brush1 = d3.brush()
        .extent([[0, 0], [ctx.w, ctx.h]])
        .on("end", brushed);
    
    function brushed(event){
        if(!event.selection) return;
        
        let [[x0, y0], [x1, y1]] = event.selection;
        console.log(x0, x1, y0, y1);
        // if selected, change the border color to highlight
        worldSvg.selectAll("path")
            .attr("stroke", d => {
                let centroid = path.centroid(d);
                if (ctx.country[d.properties.ADMIN] && centroid[0] > x0 && centroid[0] < x1 && centroid[1] > y0 && centroid[1] < y1){
                    selectedCountry.push(d.properties.ADMIN);
                    return "yellow";
                }
                return "lightgray";
            });
        console.log(selectedCountry);
        // if selected, change the parallel coordinates, hide the unselected country
        //add duration to make the transition smooth
        updateVis();
        worldSvg.selectAll(".brush").call(brush1.move, null);
    }
    enableworldmapClick(brush1);


    
}

function drawPlot(){
    drawBoxplot();
    drawParallelCoordinates();

}

function drawParallelCoordinates(){
    console.log("draw parallel coordinates");
    // different color for different country
    let y = {};
    coffeeQualityScore.forEach(s => {
       y[s] = d3.scaleLog()
        .domain(d3.extent(Object.values(ctx.country).map(d => +d[s])))
        .range([ctx.h-100, 100]);
    }
    );
    let x = d3.scalePoint()
        .domain(coffeeQualityScore)
        .range([100, ctx.w-250]);

    let axis = plotSvg.append("g").attr("id", "par_axis");
    coffeeQualityScore.forEach(s => {
        axis.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(" + x(s) + ",0)")
            .call(d3.axisLeft(y[s]));
    });
    let paths = plotSvg.append("g").attr("id", "par_paths");
    paths.selectAll(".chartpath")
        .data(Object.entries(ctx.country))
        .enter()
        .append("path")
        .attr("class", "chartpath")
        .attr("d", d => d3.line()(coffeeQualityScore.map(s => [x(s), y[s](d[1][s])])))
        .attr("fill", "none")
        .attr("stroke", d => colorScale(d[0]))
        .attr("stroke-width", 2)
    //add axis
    plotSvg.append("g")
        .attr("transform", "translate(0," + (ctx.h-100) + ")")
        .call(d3.axisBottom(x));
    //add axis label
    plotSvg.append("text")
        .attr("x", ctx.w/2-180)
        .attr("y", ctx.h-50)
        .text("Coffee Quality Score");

    //add legend on right 
    let legend = plotSvg.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(1050, 100)");
    legend.selectAll("circle")
        .data(Object.entries(ctx.country))
        .enter()
        .append("circle")
        .attr("cx", 0)
        .attr("cy", (d, i) => i*14)
        .attr("r", 5)
        .attr("fill", d => colorScale(d[0]));
    legend.selectAll("text")
        .data(Object.entries(ctx.country))
        .enter()
        .append("text")
        .attr("x", 10)
        .attr("y", (d, i) => i*14+4)
        .text(d => d[0])
        .attr("font-size", 13)
        .attr("fill", d => colorScale(d[0]))
        .on("click", function(event, d){
            selectedCountry = [d[0]];
            updateVis();
            event.stopPropagation();
        });
    plotSvg.on("click", function(event){
        selectedCountry = [];
        updateVis();
    })
}

function drawBoxplot(){
    let x = d3.scalePoint()
        .domain(coffeeQualityScore)
        .range([100, ctx.w-250]);
    let y_10 = d3.scaleLinear()
        .domain([0, 10])
        .range([ctx.h-100, 100]);
    let y_100 = d3.scaleLinear()
        .domain([50, 100])
        .range([ctx.h-100, 100]);

    plotSvg.append("g")
        .attr("id", "box_axis_10")
        .attr("transform", "translate(80,0)")
        .call(d3.axisLeft(y_10))
        .attr("opacity", 0);
    plotSvg.append("g")
        .attr("id", "box_axis_100")
        .attr("transform", "translate(1050,0)")
        .call(d3.axisRight(y_100))
        .attr("opacity", 0);

    let box = plotSvg.append("g")
        .attr("id", "box")
        .attr("opacity", 0);
    for (let i = 0; i < coffeeQualityScore.length; i++){
    s = coffeeQualityScore[i];
    let q1 = d3.quantile(Object.values(ctx.country).map(d => +d[s]), 0.25);
    let median = d3.quantile(Object.values(ctx.country).map(d => +d[s]), 0.5);
    let q3 = d3.quantile(Object.values(ctx.country).map(d => +d[s]), 0.75);
    let min = d3.min(Object.values(ctx.country).map(d => +d[s]));
    let max = d3.max(Object.values(ctx.country).map(d => +d[s]));
    //min
    box.append("line")
        .attr("x1", x(s) - 10)
        .attr("x2", x(s) + 10)
        .attr("y1", s == "Total" ? y_100(min) : y_10(min))
        .attr("y2", s == "Total" ? y_100(min) : y_10(min))
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    //max
    box.append("line")
        .attr("x1", x(s) - 10)
        .attr("x2", x(s) + 10)
        .attr("y1", s == "Total" ? y_100(max) : y_10(max))
        .attr("y2", s == "Total" ? y_100(max) : y_10(max))
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    //median
    box.append("line")
        .attr("x1", x(s) - 19)
        .attr("x2", x(s) + 19)
        .attr("y1", s == "Total" ? y_100(median) : y_10(median))
        .attr("y2", s == "Total" ? y_100(median) : y_10(median))
        .attr("stroke", "black");
    //box
    box.append("rect")
        .attr("x", x(s) - 19)
        .attr("y", s == "Total" ? y_100(q3) : y_10(q3))
        .attr("width", 38)
        .attr("height", s == "Total" ? y_100(q1) - y_100(q3) : y_10(q1) - y_10(q3))
        .attr("fill", "none")
        .attr("stroke", "black");
    //whisker   
    box.append("line")
        .attr("x1", x(s))
        .attr("x2", x(s))
        .attr("y1", s == "Total" ? y_100(q3) : y_10(q3))
        .attr("y2", s == "Total" ? y_100(max) : y_10(max))
        .attr("stroke", "black");
    box.append("line")
        .attr("x1", x(s))
        .attr("x2", x(s))
        .attr("y1", s == "Total" ? y_100(q1) : y_10(q1))
        .attr("y2", s == "Total" ? y_100(min) : y_10(min))
        .attr("stroke", "black");
    
        
    }
    

    
}


function updateVis(){
    console.log("update vis");
    select = selectedCountry;
    if (select.length > 0){
        updateBoxplot(select); 
        worldSvg.selectAll("path")
            .attr("stroke-width", d => select.includes(d.properties.ADMIN) ? 3 : 1)
            .attr("stroke", d => select.includes(d.properties.ADMIN) ? "yellow" : "lightgray");
        worldSvg.selectAll(".countryrect")
            .attr("stroke", d => select.includes(d[0]) ? "pink" : "lightgray")
            .attr("stroke-width", d => select.includes(d[0]) ? 8 : 5);

        plotSvg.selectAll(".chartpath")
            .attr("stroke", function(d){
                console.log(d[0]);
                if(select.includes(d[0])){
                    console.log("it is selected");
                    return colorScale(d[0]);
                }
                return "lightgray";
            }   )
            .attr("stroke-width", d => select.includes(d[0]) ? 2 : 0.5);
        // change the legend by removing the unselected country, change the position of the selected country
        plotSvg.select(".legend").selectAll("circle")
            .transition()
            .duration(500)
            .attr("fill", d => select.includes(d[0]) ? colorScale(d[0]) : "none")
            .attr("cy", (d, i) => select.includes(d[0]) ? select.indexOf(d[0])*12 : -10);
        plotSvg.select(".legend").selectAll("text")
            .transition()
            .duration(500)
            .attr("fill", d => select.includes(d[0]) ? colorScale(d[0]) : "none")
            .attr("y", (d, i) => select.includes(d[0]) ? select.indexOf(d[0])*12+3 : -10);
    }else{
        updateBoxplot(); 
        worldSvg.selectAll("path")
            .attr("stroke", "lightgray");
        worldSvg.selectAll(".countryrect")
            .attr("stroke", "lightgray")
        plotSvg.selectAll(".chartpath")
            .transition()
            .duration(500)
            .attr("stroke", d => colorScale(d[0]))
            .attr("stroke-width", 2)
        plotSvg.select(".legend").selectAll("circle")
            .transition()
            .duration(500)
            .attr("fill", d => colorScale(d[0]))
            .attr("cy", (d, i) => i*14);
        plotSvg.select(".legend").selectAll("text")
            .transition()
            .duration(500)
            .attr("fill", d => colorScale(d[0]))
            .attr("y", (d, i) => i*14+4);
    }

}


function loadData(){
    d3.csv("data/coffee_data.csv").then(function(data){
        console.log("Raw:",data);
        TransformData(data);
    });
    d3.json("data/countries.geojson").then(function(data){
        //filter out Antarctica
        data.features = data.features.filter(d => d.properties.ADMIN != "Antarctica");
        plotSvg = d3.select("#plot").append("svg")
            .attr("width", ctx.w)
            .attr("height", ctx.h);
        drawMap(data);
        drawPlot();
    });

}

function drawGrid(){
    let orderedCountry = Object.entries(ctx.country).sort((a, b) => b[1]["Total"] - a[1]["Total"]);
    let numCols = 7;
    let currentCol = 0;
    let currentRow = 0;
    orderedCountry.forEach((country, index) => {
        country.gridPosition = { x: currentCol, y: currentRow };
        currentCol++;
        if (currentCol >= numCols) {
            currentCol = 0;
            currentRow++;
        }
    });
    let cellsize = 120;    
    //add rect to the country
    console.log(orderedCountry);    
    let grid = worldSvg.append("g")
        .attr("id", "grid");
    grid.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", ctx.w)
        .attr("height", ctx.h)
        .attr("fill", "white")
        .attr("opacity", 0)
        .on("click", function(event){
            grid.selectAll(".countryrect")
                .attr("stroke", "lightgray")
                .attr("stroke-width", 5);
            selectedCountry = [];
            updateVis();});
    grid.selectAll(".countryrect")
        .data(orderedCountry)
        .enter()
        .append("rect")
        .attr("class", "countryrect")
        .transition()
        .duration(500) 
        .attr("x", d => d.gridPosition.x * cellsize)
        .attr("y", d => d.gridPosition.y * cellsize)
        .attr("width", cellsize)
        .attr("height", cellsize)
        .attr("fill", d => coffeecolorScale(d[1]["Total"]))
        .attr("stroke", d => selectedCountry.includes(d[0]) ? "pink" : "lightgray")
        .attr("stroke-width", d => selectedCountry.includes(d[0]) ? 8 : 5);
    grid.selectAll(".countryrect")
        .on("click", function(event, d){
            selectedCountry = [d[0]];
            updateVis();
            event.stopPropagation();
        });
    //add text to the country
    grid.selectAll("countrytext")
        .data(orderedCountry)
        .enter()
        .append("text")
        .attr("opacity", 0)
        .attr("x", d => d.gridPosition.x * cellsize + 10)
        .attr("y", d => d.gridPosition.y * cellsize + 30)
        .attr("font-size", 13)
        .attr("fill", "lightblue")
        .each(function(d) {
            // split the long country name

            let text = d3.select(this);
            if (d[0].length > 10){
            let words = d[0].split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            let lineHeight = 1.2; 
            let y = text.attr("y");
            let dy = 0;
            let tspan = text.append("tspan").attr("x", d => d.gridPosition.x * cellsize + 10).attr("y", y).attr("dy", dy + "em");
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > cellsize - 20) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = text.append("tspan").attr("x", d => d.gridPosition.x * cellsize + 10).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                }
            }}
            else{
            text.append("tspan")
                .attr("x", d => d.gridPosition.x * cellsize + 10)
                .attr("dy", 0)
                .text(d[0]);}

            text.append("tspan")
                .attr("x", d => d.gridPosition.x * cellsize + 10)
                .attr("dy", "1.2em") 
                .text(d[1]["Total"])
         })
        .transition()
        .duration(500)
        .attr("opacity", 1);


        brush2 = d3.brush()
        .extent([[0, 0], [ctx.w, ctx.h]])
        .on("end", brushed);
        function brushed(event){
            if(!event.selection) return;
            
            let [[x0, y0], [x1, y1]] = event.selection;
            console.log(x0, x1, y0, y1);
            // if selected, change the border color to highlight
            grid.selectAll(".countryrect")
                .attr("stroke", d => {
                    let centroid = [d.gridPosition.x * cellsize + cellsize/2, d.gridPosition.y * cellsize + cellsize/2];
                    if (centroid[0] > x0 && centroid[0] < x1 && centroid[1] > y0 && centroid[1] < y1){
                        selectedCountry.push(d[0]);
                        return "pink";
                    }
                    return "lightgray";
                });
            console.log(selectedCountry);
            // if selected, change the parallel coordinates, hide the unselected country
            updateVis();
            console.log("remove brush");
            worldSvg.selectAll(".brush").call(brush2.move, null);
        }
        enableworldmapClick(brush2);


   
}

function changemap(){
    worldSvg.selectAll(".brush").remove();
    console.log("change map");
    let change = document.getElementById("changemap");
    if(change.innerHTML == "Map"){
        worldSvg.on("click", null);
        change.innerHTML = "Grid";
        worldSvg.selectAll("path")
            .transition()
            .duration(500)
            .attr("opacity", 0);
        drawGrid();
       
    }else{
        worldSvg.on("click", null);
        enableworldmapClick(brush1);
        change.innerHTML = "Map";
        worldSvg.selectAll("path")
            .transition()
            .duration(500)
            .attr("opacity", 1)
            .attr("pointer-events", "all");
        worldSvg.selectAll("#grid")
            .remove();

       
    }

}

    
function enableworldmapClick(br){
    worldSvg.on("click", function(event){
        if(event.detail == 1 ){
            selectedCountry = [];
            updateVis();
        }
        if (event.detail == 2){
            worldSvg.append("g")
                    .attr("class", "brush")
                    .on("click", function(event, d){
                        if(event.detail == 1){
                            selectedCountry = [];
                            updateVis();
                        }
                        //double click to disable brush
                        if (event.detail == 2){
                            console.log("double click");
                            worldSvg.selectAll('.brush').remove();
                        }
                        event.stopPropagation();
                        })
                    .call(br);

        }
    }
    );
}

function changechart(){
    box_boolean = !box_boolean;
    let change = document.getElementById("change");
    if(change.innerHTML == "Parallel Coordinates"){
        change.innerHTML = "Boxplot";
        plotSvg.selectAll(".chartpath")
            .attr("opacity", 0);
        plotSvg.selectAll(".axis")
            .attr("opacity", 0);
        plotSvg.selectAll(".legend")
            .transition()
            .duration(500)
            .attr("transform", "translate(1100, 100)")
    
        plotSvg.selectAll("#box_axis_10")
            .transition()
            .duration(500)
            .attr("opacity", 1);
        plotSvg.selectAll("#box_axis_100")
            .transition()
            .duration(500)
            .attr("opacity", 1);
        plotSvg.selectAll("#box")
            .transition()
            .duration(500)
            .attr("opacity", 1);
 
        
    }else{
        change.innerHTML = "Parallel Coordinates";
        plotSvg.selectAll("#box")
            .transition()
            .duration(500)
            .attr("opacity", 0);
        plotSvg.selectAll("#box_axis_10")
            .transition()
            .duration(500)
            .attr("opacity", 0);
        plotSvg.selectAll("#box_axis_100")
            .transition()
            .duration(500)
            .attr("opacity", 0);
        plotSvg.selectAll(".chartpath")
            .transition()
            .duration(500)
            .attr("opacity", 1);
        plotSvg.selectAll(".axis")
            .transition()
            .duration(500)
            .attr("opacity", 1);
        plotSvg.selectAll(".legend")
            .transition()
            .duration(500)
            .attr("transform", "translate(1050, 100)");
 
    }
}

function updateBoxplot(selectedCountry){
    plotSvg.selectAll("#box")
    .remove();
    let x = d3.scalePoint()
    .domain(coffeeQualityScore)
    .range([100, ctx.w-250]);
    let y_10 = d3.scaleLinear()
        .domain([0, 10])
        .range([ctx.h-100, 100]);
    let y_100 = d3.scaleLinear()
        .domain([50, 100])
        .range([ctx.h-100, 100]);
    plotSvg.append("g")
        .attr("id", "box");
    if(box_boolean){
        plotSvg.select("#box")
            .attr("opacity", 1);
    }else{
        plotSvg.select("#box")
            .attr("opacity", 0);
    }
    let box = plotSvg.select("#box");

    for(let i = 0; i < coffeeQualityScore.length; i++){
        s = coffeeQualityScore[i];
        let q1, median, q3, min, max;
    if(selectedCountry ){
        let countries = Object.entries(ctx.country).filter(d => selectedCountry.includes(d[0]));
        let score = [];
        countries.forEach(function(d){
            d[1].forEach(function(dd){
                // push int value to score
                score.push(+dd[s]);
            });
        });
        q1 = d3.quantile(score, 0.25);
        median = d3.quantile(score, 0.5);
        q3 = d3.quantile(score, 0.75);
        min = d3.min(score);
        max = d3.max(score);
        console.log(s, "q1", q1, "median", median, "q3", q3, "min", min, "max", max)
    }
    else{
         q1 = d3.quantile(Object.values(ctx.country).map(d => +d[s]), 0.25);
         median = d3.quantile(Object.values(ctx.country).map(d => +d[s]), 0.5);
         q3 = d3.quantile(Object.values(ctx.country).map(d => +d[s]), 0.75);
         min = d3.min(Object.values(ctx.country).map(d => +d[s]));
         max = d3.max(Object.values(ctx.country).map(d => +d[s]));
    }
        //min
    box.append("line")
        .attr("x1", x(s) - 10)
        .attr("x2", x(s) + 10)
        .attr("y1", s == "Total" ? y_100(min) : y_10(min))
        .attr("y2", s == "Total" ? y_100(min) : y_10(min))
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    //max
    box.append("line")
        .attr("x1", x(s) - 10)
        .attr("x2", x(s) + 10)
        .attr("y1", s == "Total" ? y_100(max) : y_10(max))
        .attr("y2", s == "Total" ? y_100(max) : y_10(max))
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    //median
    box.append("line")
        .attr("x1", x(s) - 19)
        .attr("x2", x(s) + 19)
        .attr("y1", s == "Total" ? y_100(median) : y_10(median))
        .attr("y2", s == "Total" ? y_100(median) : y_10(median))
        .attr("stroke", "black");
    //box
    box.append("rect")
        .attr("x", x(s) - 19)
        .attr("y", s == "Total" ? y_100(q3) : y_10(q3))
        .attr("width", 38)
        .attr("height", s == "Total" ? y_100(q1) - y_100(q3) : y_10(q1) - y_10(q3))
        .attr("fill", "none")
        .attr("stroke", "black");
    //whisker   
    box.append("line")
        .attr("x1", x(s))
        .attr("x2", x(s))
        .attr("y1", s == "Total" ? y_100(q3) : y_10(q3))
        .attr("y2", s == "Total" ? y_100(max) : y_10(max))
        .attr("stroke", "black");
    box.append("line")
        .attr("x1", x(s))
        .attr("x2", x(s))
        .attr("y1", s == "Total" ? y_100(q1) : y_10(q1))
        .attr("y2", s == "Total" ? y_100(min) : y_10(min))
        .attr("stroke", "black");
    }
}


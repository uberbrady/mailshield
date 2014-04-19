
var ip=require('ip');

//format:
/*
ips table
ips= {
  //the key is a ip-to-long #
  123445677: [entries....] //NEWEST FIRST!
}
*/

/*
sample entry:
entry= [
  js_datetime,
  optional_stuff? //password hash?
]
*/

/*
Use 'binary search' algorithm to prune old entries in DB
(And other things too)
*/

/*
SHAMELESSLY STOLEN FROM:
http://oli.me.uk/2013/06/08/searching-javascript-arrays-with-a-binary-search/
THANK YOU!!!
(Heavily mangled as per the comments!)
*/
// BEGIN THEFT -
/**
 * Performs a binary search on the host array. This method can either be
 * injected into Array.prototype or called with a specified scope like this:
 * binaryIndexOf.call(someArray, searchElement);
 *
 * @param {*} searchElement The item to search for within the array.
 * @return {Number} The index of the element which defaults to -1 when not found.
 */

IPstore.binaryIndexOf=function (searchElement) {
  'use strict';

  var minIndex = 0;
  var maxIndex = this.length - 1;
  var currentIndex;
  var currentElement;

  console.warn("WE ARE LOOKING FOR: ",searchElement,"AKA",+searchElement);

  var circuitbreaker=0;
  while (minIndex <= maxIndex) {
    circuitbreaker++;
    currentIndex = (minIndex + maxIndex) >>1;
    currentElement = this[currentIndex];
    console.warn("minIndex: "+minIndex+" maxIndex: "+maxIndex+" currentIndex: "+currentIndex+" currentElement: "+currentElement);

    if (currentElement < searchElement) {
      minIndex = currentIndex+1;
    }
    else if (currentElement > searchElement) {
      maxIndex = currentIndex-1;
    }
    else {
      console.warn("KEY FOUND at: "+currentIndex);
      return currentIndex;
    }
    if(circuitbreaker>32) {
      console.warn("ERROR. circuitbreaker is: "+circuitbreaker);
      break;
    }
  }
  console.warn("KEY WAS NEVER FOUND, but it *would* be at: "+currentIndex+" min: "+minIndex+" max: "+maxIndex+". We found: "+currentElement+" at that index, and are looking for "+searchElement);
  return ~Math.max(minIndex,maxIndex);
}
// END THEFT!

//duration in seconds.
function IPstore(duration,count)
{
  console.warn("argv[0]: ",process.argv[2]);
  if(!process.argv[1].match(/mocha/) && (!duration || duration < 60)) {
    throw new Error("Invalid duration for IPstore: "+duration);
  }
  if(!count) {
    count=1;
  }
  this.duration=duration*1000;
  this.count=count;
  this.ips={};
  var that=this;
  setInterval(function () {that.cleanup()},this.duration/2);
}

IPstore.prototype.trim_db=function (entry_ip) {
  lookup_long=ip.toLong(entry_ip);
  var index=this.find_index(entry_ip);
  //basically delete an index 'index' and anything older. Right?
  if(index>=this.ips.length) { //the oldest threshhold is the length of the entire array, blow it away
    delete this.ips[lookup_long];
  } else if(index>0){ //only if you have something to delete
    this.ips[lookup_long]=this.ips[lookup_long].slice(index+1);
  }
};

IPstore.prototype.cleanup=function () {
  console.warn("ITS CLEANUP TIME BABY!");
  console.warn("IPs are: ",this.ips);
  console.warn("so duration ought to be: "+new Date(new Date() - this.duration));
  for(var i in this.ips) {
    this.trim_db(ip.fromLong(i));
  }
};

IPstore.prototype.find_index=function(lookup_ip) {
  var index=IPstore.binaryIndexOf.call(this.ips[ip.toLong(lookup_ip)],new Date(new Date() - this.duration));
  console.log("I FOUND index: "+index+" ("+~index+") out of "+this.ips[ip.toLong(lookup_ip)].length);
  if(index<0) {
    return ~index;
  } else {
    return index;
  }
};

IPstore.prototype.lookup=function (lookup_ip) {
  var lookup_long=ip.toLong(lookup_ip);
  var this_array=this.ips[lookup_long] || [];
  if(!this_array || this_array.length === 0) {
    return false;
  }
  var index=this.find_index(lookup_ip);
  if(index<0) {
    index=~index;
  }
  console.warn("Arr len: "+this_array.length+" index: "+index+" required count: "+this.count);
  return Math.floor(this_array.length-index)>=this.count;
};

IPstore.prototype.store=function (addr,opt) {
  var long=ip.toLong(addr);
  console.warn("IP: "+addr+" becomes: "+long);
  if(!this.ips[long]) {
    console.warn("No entry for "+addr+", so creating a new array..");
    this.ips[long]=[];
  }
  this.ips[long].push(new Date()); //big(late) numbers at END
  console.warn("FINE: I'm debugging the whole dmaned array");
  this.debug();
}

IPstore.prototype.debug=function() {
  for(var i in this.ips) {
    console.warn(ip.fromLong(i)+": "+this.ips[i].length+" entrie(s)");
    for(var j in this.ips[i]) {
      console.warn("[",j,"]: ",this.ips[i][j],+this.ips[i][j]);
    }
  }
  console.warn("");
}

module.exports=IPstore;

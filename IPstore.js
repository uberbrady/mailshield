
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

function binaryIndexOf(searchElement) {
  'use strict';

  var minIndex = 0;
  var maxIndex = this.length - 1;
  var currentIndex;
  var currentElement;

  while (minIndex <= maxIndex) {
      currentIndex = (minIndex + maxIndex) / 2 | 0;
      currentElement = this[currentIndex];

      if (currentElement < searchElement) {
          minIndex = currentIndex + 1;
      }
      else if (currentElement > searchElement) {
          maxIndex = currentIndex - 1;
      }
      else {
          console.warn("KEY FOUND at: "+currentIndex);
          return currentIndex;
      }
  }
  console.warn("KEY WAS NEVER FOUND, but it *would* be at: "+currentIndex);
  return ~currentIndex;
}
// END THEFT!

//duration in seconds.
function IPstore(duration,count)
{
  if(!duration || duration < 60) {
    throw new Error("Invalid duration for IPstore: "+duration);
  }
  if(!count) {
    count=1;
  }
  this.duration=duration;
  this.count=count;
  this.ips={};
  var that=this;
  setInterval(function () {that.cleanup()},duration*1000/2);
}

IPstore.prototype.trim_db=function (entry_ip,older_than) {
  lookup_long=ip.toLong(entry_ip);
  var index=binaryIndexOf.call(this.ips[lookup_long],older_than);
  //basically delete an index 'index' and anything older. Right?
  if(index<0) { //if it wasn't found *exactly* (which is very likely!)
    index=~index; //then this is the index where it *would* be
  }
  if(index>=this.ips.length) { //the oldest threshhold is the length of the entire array, blow it away
    delete this.ips[lookup_long];
  } else if(index>0){ //only if you have something to delete
    this.ips[lookup_long]=this.ips[lookup_long].slice(index+1);
  }
};

IPstore.prototype.cleanup=function () {
  console.warn("ITS CLEANUP TIME BABY!");
  for(var i in this.ips) {
    this.trim_db(i,new Date() - this.duration);
  }
};

IPstore.prototype.lookup=function (lookup_ip) {
  var lookup_long=ip.toLong(lookup_ip);
  var this_array=this.ips[lookup_long] || [];
  var index=binaryIndexOf.call(this_array,this.duration);
  if(index<0) {
    index=~index;
  }
  console.warn("Arr len: "+this_array.length+" index: "+index+" required count: "+this.count);
  return Math.floor(this_array.length-index)>this.count;
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
  console.warn(this.ips);
}

IPstore.prototype.debug=function() {
  for(var i in this.ips) {
    console.warn(ip.fromLong(i)+": "+this.ips[i].length+" entrie(s)");
  }
}

module.exports=IPstore;

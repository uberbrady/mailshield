
var ip=require('ip');

var ips={};

var cfg=require('./configuration.json');
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
  offensecode, //integer
  optional_stuff? //password hash?
]
*/

var OFFENSES={
  'BAD_RCPT': 1,
  'BAD_AUTH': 2,
  'GOOD_RCPT': 3,
  'BLACKLIST': 4
};



/*
Use 'binary search' algorithm to prune old entries in DB
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
          return currentIndex;
      }
  }

  return ~currentIndex;
}
// END THEFT!

function IPstore()
{

}

IPstore.trim_db=function (entry_ip) {
  lookup_long=ip.toLong(entry_ip);
  var index=binaryIndexOf.call(ips[lookup_long],new Date()-cfg.delete_threshhold*1000);
  //basically delete an index 'index' and anything greater. Right?
  if(index<0) { //if it wasn't found *exactly* (which is very likely!)
    index=~index; //then this is the index where it *would* be
  }
  if(index === 0) { //first entry is that old? Blow out your whole hash entry.
    delete ips[lookup_long];
  } else if(index<ips.length){ //only if you have something to delete
    ips[lookup_long]=ips[lookup_long].slice(0,index-1);
  }
};

IPstore.cleanup=function () {
  for(var i in ips) {
    IPstore.trim_db(i);
  }
};

setInterval(IPstore.cleanup,cfg.delete_frequency);

//YES, these are WEIRD CLASS METHODS
IPstore.lookup=function (lookup_ip) {
  return ips[ip.toLong(lookup_ip)]; //returns array of awkward crap :(
};

IPstore.store=function (addr,offense,opt) {
  if(!OFFENSES[offense]) {
    throw new Error("Unknown Offense: "+offense);
  }
  var long=ip.toLong(addr);
  console.warn("IP: "+addr+" becomes: "+long);
  if(!ips[long]) {
    console.warn("No entry for "+addr+", so creating a new array..");
    ips[long]=[];
  }
  ips[long].push([new Date(),OFFENSES[offense]]); //big(late) numbers at END
  console.warn("FINE: I'm debugging the whole dmaned array");
  console.warn(ips);
}

IPstore.debug=function() {
  console.warn("I AM DEBUGGIGINGIGNIN!");
  for(var i in ips) {
    console.warn("I IS: "+i);
    console.warn(ip.fromLong(i)+": "+ips[i].length+" entrie(s)");
  }
}

module.exports=IPstore;

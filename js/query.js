MWS.query = function(text, math){
	var me = this; 

	//store parameters for query
	this._text = text; 
	this._math = math; 

	this._cached = false; 

	var get = function(start, size, callback, callback_fail){
		if(arguments.length == 1){
			var callback = start; 
			var start = 0; 
			var size = 5; 
		}

		if(typeof callback !== "function"){
			var callback = function(){}; //Nothing
		}

		if(typeof callback_fail !== "function"){
			var callback_fail = function(){}; //Nothing
		}

		var data = {
			"text": me._text, 
			"math": me._math, 
			"from": start, 
			"size": size
		}; 
		try{
			$.ajax({
			    type: 'GET',
			    url: MWS.config.mws_query_url,
				data: data
			}).done(function(data) {
			    callback.call(me, data); 
			}).fail(function(){
				callback_fail.call(me); 
			}); 
		} catch(e){
			callback_fail.call(me); 
		}
		
	};


	var split_xhtml = function(node){
		var res = []; 

		$(node).contents().each(function(){
			if(this.nodeType == 3){
				//text node
				res = res.concat(
						$(this)
						.text().split("; ")
						.filter(function(e){return e?true:false;})
				);
			} else {
				res.push(this);
			}
		}); 

		return res; 
	};

	var make_proper_entry = function(hit, qvars){
		var xhtml = $(jQuery.parseXML(hit.xhtml));
        return {
			"data": {
                "id" : hit.id,
                "metadata" : hit.metadata,
                "snippets" : hit.snippets
			},
			"math_hits": hit.maths.map(function(m){
				return {
						"id": m.replaces,
                        "source" : m.source,
						"xpath": m.highlight_xpath,
						"qvars": qvars.map(function(q){
							return {
								"name": q.name, 
								"xpath": m.xpath+q.xpath, 
								"relpath": q.xpath
							}
						})
				};
			})
		}; 
	}; 

	this.getAll = function(callback, callback_schemata, callback_fail){
		var callback = (typeof callback == "function")?callback:function(){}; 
		var callback_fail = (typeof callback_fail == "function")?callback:function(){}; 


		get(0, 0, function(data){
			var cache = {}; 

			var count = data.total || 0; 

            var processedSchemata = false;

			var res = function(from, len, cb, cb_fail){
				var ret = []; 
				ret.qvars = data.qvars; 

				if(len <= 0){
					return cb([]); //ok, we have nothing to return 
				}

				var iter = function(i, stop){

					if(i>=len){
						return cb(ret); 
					}

					var here = from + i; 
					if(cache.hasOwnProperty("res_"+here)){
						//is in local cache
						ret.push(cache["res_"+here]); 
						return iter(i+1); 
					} else {
						if(!stop && here <= count){
							//retrieve the entries if we are not above the length
							get(here, len-i, function(data){ //get the remaining entries
								var hits = data.hits; 
                                if (!processedSchemata) {
                                    callback_schemata(data.schemata);
                                    processedSchemata = true;
                                }
								for(var j=0;j<hits.length;j++){
									cache["res_"+(here+j)] = make_proper_entry(hits[j], data.qvars);
								}

								iter(i, true); 
							}); 
						} else {
							iter(i+1); 
						}
					}

				};

				iter(0); 
			}; 

			res.count = count; 

			callback(res);
		}, callback_fail); 
	}
}

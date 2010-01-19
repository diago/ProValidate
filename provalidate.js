/*
The MIT License

Copyright (c) 2010 Heath Padrick

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var ProValidate = (function(){

    var ProValidate = Class.create();
    
    ProValidate.Version = '1.0.0';
    
    ProValidate.Debug = false;
    
    ProValidate.instances = $H();
    
    ProValidate.instance = function(form, options){
        var instance = ProValidate.instances.get($(form).identify());
        
        if(instance && options){
        	instance.setOptions(options);
        } else if(!instance){
        	instance = new ProValidate(form, options);
        	ProValidate.instances.set($(form).identify(), instance);
        }
        
        return instance;
    };
    
    ProValidate.lang = {
    	defaultMessages: {
	    	required: 'Required',
	    	phone: 'Invalid phone number',
	    	email: 'Invalid email',
	    	alpha: 'Letters only',
	    	alpha_numeric: 'Numbers and letters only',
	    	numeric: 'Invalid number',
	    	date: 'Invalid date',
	    	digit: 'Numbers only',
	    	price: 'Invalid price',
	    	matches: 'Must confirm'
    	}
    };
    
    ProValidate.options = {
    	/**
    	 * @var str Name used in Element#store for rules and messages
    	 */
    	storeName: 'provalidate',
    	
    	/**
    	 * @var str name of the hanlder class to instantiate
    	 */
    	handler: 'ProValidate.Handler'
    };
    
    ProValidate.prototype = {
        initialize: function(form, options){
            this.options = {};
            Object.extend(this.options, ProValidate.options);
            Object.extend(this.options, options || {});

            this.form = $(form).observe('submit', function(ev){
            	ev.stop();
            	this.handler.clearErrors(); // start fresh
            	this.validate();
            }.bind(this));
            this.elements = this.form.getElements();

            var handler = getObject(this.options.handler);
            this.handler = new handler(this.form.identify(), this.options);
        },
        
        validate: function(elem, trigger){
        	var elem = elem || $(elem), trigger = (trigger !== false);
        	if(!elem) { // validate the entire form
        		var failures = this.elements.map(function(elem){
        			return this._validateElement(elem, trigger);
        		}.bind(this));
        		if(failures.indexOf(false) === -1) this.form.fire('form:valid'); 
        	} else return this._validateElement(elem, trigger);
        },
        
        _validateElement: function(elem, trigger){
        	var rules = elem.retrieve(this.options.storeName);
        	if(!rules) return true;
        	var failures = [], failed = false, x;
        	for(x in rules){        		
        		try {
        			failed = !ProValidate.rules[x](elem, rules[x].parameters || false, this.form);
        		} catch(e) {
        			if(ProValidate.Debug) throw e;
        		}        		
        		if(failed) failures.push(x);
        	}
        	if(failures.length > 0) {
        		if(trigger) {
                	this.handler.clearErrors(elem); // start clean
        			this.handler.onFailed(elem, failures);
        		}
        		return false;
        	}
        	else{
        		if(trigger) this.handler.onValid(elem);
        		return true;
        	}
        },
        
        setOptions: function(options){
        	Object.extend(this.options, options || {});
        },
        
        rules: function(elem, rules){
            var elem = ProValidate.findRealElement(this.form, elem);
            if(elem.nodeName.toUpperCase() === 'FORM') this.addRules(rules);
            else this.addElementRules(elem, rules);
            return elem;
        },
        
        removeRules: function(elem, rules){
        	var store, elem = ProValidate.findRealElement(this.form, elem);
        	store = elem.retrieve(this.options.storeName);
        	
        	if(! rules) store = {};
        	else if(Object.isArray(rules)) for(var r=0;r<rules.length;r++) delete store[rules[r]];        		
        	else if(Object.isString(rules)) delete store[rules];
        	
        	elem.store(this.options.storeName, store);
        	return elem;
        },
        
        addRules: function(rules){
        	for(var x in rules){
        		this.addElementRules(x, rules[x]);
        	}
        	return this.form;
        },
        
        addElementRules: function(elem, rules){
        	var elem = ProValidate.findRealElement(this.form, elem);
        	var data = rules;
        	if(Object.isString(data)){
        		var rules = {};
        		rules[data] = {};
        	}
        	elem.mergeStore(this.options.storeName, rules);
        	return elem;
        }    
    };
    
    
    /**
     * Search for the elem given. First tries to return an element found
     * by id, next tries to return an element with a name that begins with elem
     * 
     * @TODO somehow needs to support nested names
     * 
     * @var form str form to search in
     * @var elem str elem to look for
     * @return elem
     */
    ProValidate.findRealElement = function(form, elem){
        return $(elem) || $(form).select('[name^="'+elem+'"]').first();    	
    };
    
    ProValidate.Handler = Class.create();
    
    ProValidate.Handler.options = {
    	defaultInvalidMessage: 'Invalid',
    	errorMessageClassName: 'errorMessage',
    	invalidElementClassName: 'invalid'
    };
    
    ProValidate.Handler.prototype = {
    	initialize: function(form, options){
    		this.options = {};
    		Object.extend(this.options, ProValidate.Handler.options);
    		Object.extend(this.options, options || {});

    		this.form = $(form);
    	},
        onFailed: function(elem, failures){
            var elem = $(elem),            
            rules = elem.retrieve(this.options.storeName),
            rule = failures[0],
            message = rules[rule].message;
            this.triggerError(elem, message || ProValidate.lang.defaultMessages[rule] || this.options.defaultInvalidMessage);
        },
        triggerError: function(elem, message){
            var elem = ProValidate.findRealElement(this.form, elem), 
            span = Element('span')
            .addClassName(elem.identify())
            .addClassName(this.options.errorMessageClassName)
            .update(message);
            
            elem.addClassName(this.options.invalidElementClassName).insert({after: span});
        },
        onValid: function(elem){
            $(elem).removeClassName(this.options.invalidElementClassName);
            $$('.'+elem.identify()).invoke('remove');
        },
        clearErrors: function(elem){
        	var elem = $(elem);
        	if(elem){
        		elem.removeClassName(this.options.invalidElementClassName);
        		$$('span.'+elem.identify()).invoke('remove');
        	} else {
	            this.form.select('.'+this.options.errorMessageClassName).invoke('remove');
	            this.form.select('.'+this.options.invalidElementClassName)
	            .invoke('removeClassName', this.options.invalidElementClassName);
        	}
        }
    };
    
    ProValidate.rules = {
    	datePattern: '\\d{1,2}\\/\\d{1,2}\\/\\d{4}',
		required: function(elem){
    		var type = elem.readAttribute('type'),
    		realRule = '_required_'+type;
    		try {
    			return ProValidate.rules[realRule](elem);
    		} catch(e) {
    			if(ProValidate.Debug) throw e;
    		}
		},
		_required_text: function(elem){
			return !$F(elem).empty();
		},
		_required_password: function(elem){
			return ProValidate.rules._required_text(elem);
		},
		_required_checkbox: function(elem, p, form){
			var elem = $(elem);			
			return $(form).select('[name="'+elem.readAttribute('name')+'"]:checked').length > 0;
		},
		_required_radio: function(elem, p, form){
			var elem = $(elem);
			radios = $(form).select('[name="'+elem.readAttribute('name')+'"]');
			return radios.find(function(radio){ return (radio.getValue() !== null); });			
		},
		length: function(elem, params){
			var status = false, value = $F(elem), size = value.length;			
			if(value.empty()) return true;			
			
			if(Object.isArray(params) && params.length === 2){
				var min = param[0] * 1;
				var max = param[1] * 1;
				if (size >= min && size <= max){
					status = true;
				}
			} else status = (size === (params * 1));
			
			return status;
		},
		matches: function(elem, param, form){
			var value = $F(elem), matches = false,
			match = $(form).select('[name="'+param+'"]').first() || $(param);
			if(match) matches = (value === $F(match));
			return value.empty() ? true : matches;
		},
		alpha: function(elem){
			var value = $F(elem);
			return value.empty() ? true : /^[a-zA-Z]*$/.test(value);
		},
		alpha_numeric: function(elem){
			var value = $F(elem);
			return value.empty() ? true : /^[a-zA-Z0-9]*$/.test(value);
		},
		digit: function(elem){
			return /^\d*$/.test($F(elem));
		},
		numeric: function(elem, decChar){
			var value = $F(elem),
			dec = decChar || '.',
			exp = new RegExp('^-?[0-9]*\\'+dec+'?[0-9]*$');
			return value.empty() ? true : exp.test(value);			
		},
		email: function(elem){
			var value = $F(elem);
			return value.empty() ? true : /^[a-zA-Z][\w\.-]*[a-zA-Z0-9]@[a-zA-Z][\w\.-]*[a-zA-Z0-9]\.[a-zA-Z][a-zA-Z\.]*[a-zA-Z]$/.test($F(elem));
		},
		phone: function(elem, params){
			var value = $F(elem),
			realNumber = value.gsub(/\D/, ''),
			length = params || [7, 10, 11];
			return value.empty() ? true : length.indexOf(realNumber.length) !== -1;
		},
		date: function(elem, pattern){
			var value = $F(elem),
			format = new RegExp(pattern || ProValidate.rules.datePattern);
			return value.empty() ? true : format.test(value);
		},
		price: function(elem){
			var value = $F(elem);
			return value.empty() ? true : /^\$?(\d{1,3}\,?\d{3}|\d{1})*(\.?\d{2})?$/.test(value);
		}
    };

    
    // add the methods    
    var formElementMethods = {
	    validate: function(elem){
	        var elem = $(elem), form = elem.up('form');
	        ProValidate.instance(form).validate(elem);
	        return elem;
	    },
	    valid: function(elem){
	        var elem = $(elem), form = elem.up('form');
	        return ProValidate.instance(form).validate(elem, false);        	
	    },
	    rules: function(elem, rules){
	        var elem = $(elem), form = elem.up('form');
	        ProValidate.instance(form).rules(elem, rules);
	        return elem;
	    },
	    rule: function(elem, rule){ // just an alias
	    	return $(elem).rules(rule);
	    },
	    removeRules: function(elem, rules){
	        var elem = $(elem), form = elem.up('form');	    	
	    	ProValidate.instance(form).removeRules(elem, rules);
	    	return elem;
	    },
	    removeRule: function(elem, rules){// just an alias
	    	return $(elem).removeRules(rules);
	    },
	    error: function(elem, message){
	        var elem = $(elem), form = elem.up('form');
	    	ProValidate.instance(form).handler.triggerError(elem, message);
	    	return elem;
	    },
	    clearError: function(elem){
	        var elem = $(elem), form = elem.up('form');
	    	ProValidate.instance(form).handler.clearErrors(elem);
	    	return elem;
	    }    		
    };
    
    Element.addMethods('INPUT', formElementMethods);
    Element.addMethods('SELECT', formElementMethods);
    Element.addMethods('TEXTAREA', formElementMethods);
    
    Element.addMethods('FORM', {
        validate: function(form, options){
            ProValidate.instance(form, options).validate();
            return form;
        },
        rules: function(form, rules, options){
        	ProValidate.instance(form, options).rules(form, rules);
        	return form;
        },
        errors: function(form, errors){
        	for(var x in errors){
            	ProValidate.instance(form).handler.triggerError(x, errors[x]);	
        	}
        	return form;
        },
        clearErrors: function(form){
        	ProValidate.instance(form).handler.clearErrors();
        	return form;
        }
    });
    
    Element.addMethods({
    	mergeStore: function(elem, storeName, data){
    		var allData = elem.retrieve(storeName);
    		if(Object.isUndefined(allData)){
    			// first time storage
    			return elem.store(storeName, data);
    		}    		
    		Object.extend(allData, data);
    		return elem.store(storeName, allData);
    	}
    });
    
    // funcs
    /**
     * provided by tfluehr @ http://www.tfluehr.com
     * 
     * creates the needed obj for the instantiation of the handler
     */
    var getObject = function(parts){
	    if (typeof(parts) == 'string') parts = parts.split('.');
	    var obj = window;
	    for (var i = 0, p; obj && (p = parts[i]); i++)
	    {
	    	obj = (p in obj ? obj[p] : undefined);
	    }
	    return obj;
    };
    
    return ProValidate;

})();
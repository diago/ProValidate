/*
The MIT License

Copyright (c) 2009 Heath Padrick

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
	
	ProValidate.Version = '0.4.1';
	
	ProValidate.options = {
			
			/**
			 * If true the form will submit as normal. False causes Event.stop();
			 */
			submitOnValid: true,			
			
			/**
			 * Class that is added to the form elements that are invalid
			 */
			errorClass: 'invalid',
			
			/**
			 * Class that's given to the error messages in errorTemplate.
			 */
			errorMessageClass: 'errorMessage',
			
			/**
			 * By default this is inserted under the invalid element. You can make what ever element you need.
			 * The input element id, errorMessageClass and message are filled using Prototype's Template#evaluate.
			 * Inorder for clearInvalid(elem) to work you need to add #{elementId} to the class 
			 */
			errorTemplate: '<span class="#{elementId} #{errorMessageClass}">#{message}</span>',

			/**
			 * Causes ProValidate to check Element#store for a 'provalidate' {rules: message} object.
			 * Set to false if you are adding rules manually with addRule or addRules to save a loop.
			 */
			checkStore: true,
			
			/**
			 * Class name given to an invalid form
			 */
			invalidFormClass: 'invalidForm',
			
			/**
			 * Use to setup default messages for validations. 
			 * 
			 * @example {rule: "Message", rule2: "Message"}
			 */
			cannedMessages: {
				required: 'Required',
				phone: 'Invalid phone number',
				email: 'Invalid email',
				alpha: 'Letters only',
				alpah_numeric: 'Numbers and letters only',
				numeric: 'Invalid number',
				date: 'Invalid date',
				digit: 'Numbers only',
				price: 'Invalid price'
			},
			
			/**
			 * If ProValidate can't find a message this is the default for any invalid elements.
			 */
			defaultInvalidMessage: 'Invalid',
			
			/**
			 * Runs when the class is initialized
			 * @param this The entire instance is passed in
			 */
			onStart: Prototype.emptyFunction,
			
			/**
			 * Runs when an element is invalid
			 * @param element The element that is being validated
			 * @param rule The rule that failed
			 * @param message The message associated with the rule
			 * @param this The entire instance is passed in
			 * 
			 * Returns true here to trigger the default invalid method. Do not
			 * return true unless you want the default to run.
			 */
			onInvalid: function(){return true;},
			
			/**
			 * Runs when an element is valid
			 * @param element The element that is being validated
			 * @param this The entire instance is passed in
			 */
			onValid: Prototype.emptyFunction,
			
			/**
			 * Called when everything passes validation
			 * @param this The entire instance is passed in
			 */
			onFormValid: Prototype.emptyFunction
	};
	
	ProValidate.prototype = {
		initialize: function(form, options){
			this.options = Object.extend(ProValidate.options, options || {});
			
			this.form = $(form);
			
			this.elements = $H();
			this.errorTemplate = new Template(this.options.errorTemplate);
			this.cannedMessages = $H(this.options.cannedMessages);
			this._storedRulesAdded = false;
			
			this.form.observe('submit', this._validate.bindAsEventListener(this));

			this.options.onStart(this);
			
			/* May add inline option later using html5 data-* attribute
			$$('form#'+this.form.identify()+' [data-provalidate]').each(function(elem){
				this.inlineRules(elem);
			}.bind(this));			
			*/
			
			// focus errors that could have been added from the server
			var current_errors = $$('.'+this.options.errorClass);
			if(current_errors.length > 0) current_errors.first().select();
		},
		
		/* May add inline option later using html5 data-* attribute
		inlineRules: function(elem){
			var elem = $(elem);
			rules = elem.readAttribute('data-provalidate');
			
			// stay valid
			if(! ProValidate.HTML5) elem.removeAttribute('data-provalidate');
			
			if(rules){
				this._addRules(elem, this._toRules(rules));
			}
			return this;
		},
		*/
		
		/**
		 * Validates an element to its rules
		 * @param elem The element to validate
		 * @param rules Can be a string for one rule or a hash of rules messages to use.
		 * @return bool
		 */
		validate: function(elem, rules){
			
			var elem = this._realElement(elem);
			var eid = elem.identify();
			var valid = false;
			var rule, msg, fillTemp;
			if(Object.isString(rules)){
				var container = this.elements.get(eid);
				allRules = $H();
				allRules.set(rules, container.get(rules));
			} else if(Object.isUndefined(rules)){
				allRules = this.elements.get(eid);
			} else {
				allRules = $H(rules);
			}
			
			allRules.each(function(pair){
				rule = pair.key;
				msg = pair.value;
				if(!(valid = this._test(elem, rule))){
					this.trigger(elem, rule, msg);
					throw $break;
				}
			}.bind(this));
				
			this.options.onValid(elem, this);
			
			return valid;
		},
		
		/**
		 * Triggers an error for an element.
		 * 
		 * @param elem Element to trigger the error on
		 * @param rule <string> Rule to trigger. Used to find an error message
		 * @param msg <optional> Message to display
		 */
		trigger: function(elem, rule, msg){
			var elem = this._realElement(elem);
			elem.addClassName(this.options.errorClass);
			fillTemp = {
				elementId: elem.identify(),
				errorMessageClass: this.options.errorMessageClass,
				message: msg || this._findErrorMessage(elem, rule)
			};
			if(this.options.onInvalid(elem, rule, msg, this) === true){
				elem.insert({after: this.errorTemplate.evaluate(fillTemp)});
			}
			this.form.addClassName(this.options.invalidFormClass);
			return this;
		},
		
		/**
		 * Manual adds a single rule to an element
		 * 
		 * @param elem Element to add the rule to
		 * @param rule <string> Rule to add
		 * @param msg <optional> Message to display
		 */
		addRule: function(elem, rule, message){
			var elem = this._realElement(elem);
			var rules;
			var message = message || this._findErrorMessage(elem, rule);
			if( rules = this.elements.get(elem.identify()) ){
				rules.set(rule, message);
			} else {
				var rules = $H();
				rules.set(rule, message);
				this.elements.set(elem.identify(), rules);				
			}
			return this;
		},
		
		/**
		 * Add multiple rules and messages to an element
		 * 
		 * @param elem The element to add the rules to
		 * @param rules <object> {} of rules: messages
		 */
		addRules: function(elem, rules){
			if(Object.isArray(rules) || typeof rules !== "object") throw ('rules must be an object {}');
			var x;
			for(x in rules){
				this.addRule(elem, x, rules[x]);
			}
			return this;
		},
		
		/**
		 * Removes a rule from an element
		 * 
		 * @param elem  The element to remove the rule from
		 * @param rules <string> rule name to remove
		 */
		removeRule: function(elem, rule){
			var elem = this._realElement(elem);
			var eid = elem.identify();
			var rules = this.elements.get(eid);
			rules.unset(rule);
			this.elements.set(eid, rules);
			return this;
		},
		
		add: function(elem){
			this._current = elem;
			return this;
		},
		
		rule: function(rule, message){
			this.addRule(this._current, rule, message || false);
			return this;
		},
		
		/**
		 * Adds an elements stored rules from Element#store
		 * @param elem
		 * @return this
		 */
		storedRules: function(elem){
			var rules;
			if(rules = $(elem).retrieve('provalidate')){
				this.addRules(elem, rules);
				// cleanup
				$(elem).store('provalidate', null);
			}
			return this;
		},
		
		/**
		 * Clears all invalid messages and classes.
		 * If an element is given it will only clear messages and classes
		 * related to it.
		 * 
		 * @param elem <optional> Element to clear 
		 */
		clearInvalid: function(elem){
			if(elem){
				var elem = this._realElement(elem);
				elem.removeClassName(this.options.errorClass);
				$$('.'+elem.identify()).invoke('remove');
			} else {
				$$('.'+this.options.errorMessageClass).invoke('remove');
				$$('.'+this.options.errorClass).invoke('removeClassName', this.options.errorClass);
				this.form.removeClassName(this.options.invalidFormClass);
			}
			return this;
		},
		
		_validate: function(ev){
			// run through elem stores to find rules and messages
			if(!this._storedRulesAdded && this.options.checkStore){
				this.form.getElements().each(function(elem){
					this.storedRules(elem);
				}.bind(this));
				this._storedRulesAdded = true;
			}
			
			var elem = ev.element();
			var invalid;
			this.clearInvalid();
			this.elements.each(function(pair){
				
				elem = pair.key;
				rules = pair.value;
				this.validate(elem, rules);
				
			}.bind(this));
			
			invalid = $$('.'+this.options.errorClass);
			if(invalid.length > 0){
				ev.stop();
				invalid.first().select();
			} else {
				if( ! this.options.submitOnValid ) ev.stop();
				this.options.onFormValid(this);
			}
		},
		
		_test: function(elem, rule){
			var elem = $(elem);
			var rule = this._ruleAndParams(rule);
			
			if(Object.isArray(rule)){
				var r = rule[0];
				var p = rule[1];
				if(Object.isFunction(ProValidate.Validation[r]))
					return ProValidate.Validation[r](elem, p);
			} else {
				if(Object.isFunction(ProValidate.Validation[rule]))
					return ProValidate.Validation[rule](elem);
			}
			return true;
		},
		
		_addRules: function(elem, rules){
			var elem = $(elem).identify();
			for(i=0;i<rules.length;i++){
				this.addRule(elem, rules[i]);
			}
		},
		
		_findErrorMessage: function(elem, rule){
			return this.cannedMessages.get(rule.match(/[\w]+/).first()) || this.options.defaultInvalidMessage;
		},
		
		_realElement: function(elem){
			return $(elem) || $$('#'+this.form.identify()+' [name="'+elem+'"]').first();
		},
		
		_ruleAndParams: function(rule){
			var match = rule.match(/(\w.*)\[(.*)\]/);
			return (match === null) ? rule : [match[1],match[2]];
		}
	};
	
	ProValidate.Validation = {
		datePattern: '\\d{1,2}\\/\\d{1,2}\\/\\d{4}',
		required: function(elem){
			var value = $F(elem);
			return !value.empty();
		},
		length: function(elem, params){
			var size;
			var value = $F(elem);
			var status = false;
			var param;
			
			if(value.empty()) return true;
			if(!Object.isString(value)) return false;
			
			size = value.length;
			
			param = params.split(',');
			if( param.length > 1){
				var min = param[0] * 1;
				var max = param[1] * 1;
				if (size >= min && size <= max){
					status = true;
				}
			} else {
				status = (size === (params * 1));
			}
			return status;
		},
		matches: function(elem, param){
			var value = $F(elem);
			var matches = false;
			var match = $$('[name="'+param+'"]').first() || $(param);
			if(match){
				matches = (value === $F(match));
			}
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
			var value = $F(elem);
			return /^\d*$/.test(value);
		},
		numeric: function(elem, decChar){
			var value = $F(elem);
			var dec = decChar || '.';
			var exp = new RegExp('^-?[0-9]*\\'+dec+'?[0-9]*$');
			return value.empty() ? true : exp.test(value);			
		},
		email: function(elem){
			var value = $F(elem);
			return value.empty() ? true : /^[a-zA-Z][\w\.-]*[a-zA-Z0-9]@[a-zA-Z][\w\.-]*[a-zA-Z0-9]\.[a-zA-Z][a-zA-Z\.]*[a-zA-Z]$/.test($F(elem));
		},
		phone: function(elem, params){
			var value = $F(elem);
			var length;
			var realNumber = value.gsub(/\D/, '');
			if(Object.isUndefined(params)){
				length = [7, 10, 11];
			} else {
				length = params.split(',').map(function(num){
					return parseInt(num, 10);
				});
			}
			return value.empty() ? true : ((length.indexOf(realNumber.length) === -1) ? false : true);
		},
		date: function(elem, pattern){
			var value = $F(elem);
			var format = new RegExp(pattern || ProValidate.Validation.datePattern);
			return value.empty() ? true : format.test(value);
		},
		price: function(elem){
			var value = $F(elem);
			return value.empty() ? true : /^\$?(\d{1,3}\,?\d{3}|\d{1})*(\.?\d{2})?$/.test(value);
		}
	};
	
	return ProValidate;
})();
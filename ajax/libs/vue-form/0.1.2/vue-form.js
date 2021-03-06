﻿; (function () {
    var vueForm = {};
    vueForm.install = function (Vue) {

        function closest(elem, selector) {
            var matchesSelector = elem.matches || elem.webkitMatchesSelector || elem.mozMatchesSelector || elem.msMatchesSelector;
            while (elem) {
                if (matchesSelector.call(elem, selector)) {
                    return elem;
                } else {
                    elem = elem.parentElement;
                }
            }
            return null;
        }

        function removeClassWithPrefix(el, prefix) {            
            var classes = el.className.split(" ").filter(function(c) {
                return c.lastIndexOf(prefix, 0) !== 0;
            });
            el.className = (classes.join(" ")).trim();
        }
        
        var emailRegExp = /^[a-z0-9!#$%&'*+\/=?^_`{|}~.-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i, // from angular
            urlRegExp = /^(http\:\/\/|https\:\/\/)(.{4,})$/,
            dirtyClass = 'vf-dirty',
            pristineClass = 'vf-pristine',
            validClass = 'vf-valid',
            invalidClass = 'vf-invalid',
            submittedClass = 'vf-submitted',
            attrs = [
                'type',
                'required',
                'pattern',
                'multiple',
                'minlength',
                'maxlength',
                'min',
                'max',
                'custom-validator'
            ],
            attrsWithValue = [
                'minlength',
                'maxlength',
                'min',
                'max',
                'pattern'
            ];

        var validators = {
            required: function (value) {
                if (Vue.util.isArray(value)) {
                    return !!value.length;
                }
                return !!value;
            },
            email: function (value, multiple) {
                if (typeof value === 'undefined') {
                    return true;
                }
                if (!value.trim()) {
                    return true;
                }
                return emailRegExp.test(value);
            },
            number: function (value) {
                return !isNaN(value);
            },
            url: function (value) {
                return urlRegExp.test(value);
            },
            minlength: function (value, length) {
                return value.length >= length;
            },
            maxlength: function (value, length) {
                return length >= value.length;
            },
            pattern: function (value, pattern) {
                var patternRegExp = new RegExp('^' + pattern + '$');
                return patternRegExp.test(value);
            },
            min: function (value, min) {
                return value >= min;
            },
            max: function (value, max) {
                return max >= value;
            }
        };
        
        // check if an attribute exists, static or binding.
        // if it is a binding, watch it and re-validate on change
        function checkAttribute($this, attribute) {
            var vueFormCtrl = $this._vueFormCtrl;
            var binding = Vue.util.getBindAttr($this.el, attribute);           
            if (binding) {
                $this.vm.$watch(binding, function (value, oldValue) {
                    vueFormCtrl[attribute] = value;
                    if (attribute === 'type') {
                        delete vueFormCtrl.validators[oldValue];
                        vueFormCtrl.validators[value] = validators[value];
                    } else {
                        vueFormCtrl.validators[attribute] = validators[attribute];
                        if (value === false || typeof value === 'undefined') {
                            vueFormCtrl.validators[attribute] = false;
                        }
                    }
                    if($this._vueForm) {
                        vueFormCtrl.validate($this._value);  
                    } else {
                        // this is for when an input is inside a v-if
                        // and will not be inserted into the dom for 
                        // some time
                        Vue.nextTick(function () {
                            Vue.nextTick(function () {
                                vueFormCtrl.validate($this._value);
                            });
                        });
                    } 
                }, { immediate: true });
            }
            var staticAttr = $this.el.getAttribute(attribute);
            if (staticAttr !== null) {
                vueFormCtrl[attribute] = staticAttr || true;
                if (attribute === 'type') {
                    vueFormCtrl.validators[staticAttr] = validators[staticAttr];
                } else if (attribute === 'custom-validator') {
                    vueFormCtrl.validators[attribute] = $this.vm[staticAttr];
                } else {
                    vueFormCtrl.validators[attribute] = validators[attribute];
                }
            }

        }

        Vue.directive('form', {
            id: 'form',
            priority: 10001,
            bind: function () {
                var  el = this.el,
                    formName = el.getAttribute('name'),
                    hook = el.getAttribute('hook'),
                    vm = this.vm,                   
                    self = this,
                    controls = {};

                el.noValidate = true;

                var state = this._state = {
                    $name: formName,
                    $dirty: false,
                    $pristine: true,
                    $valid: true,
                    $invalid: false,
                    $submitted: false,
                    $error: {}
                };

                // set inital state
                vm.$set(formName, state);
                Vue.util.addClass(el, pristineClass); 
                Vue.util.addClass(el, validClass); 
                
                var vueForm = this.el._vueForm = {
                    name: formName,
                    state: state,
                    addControl: function (ctrl) {
                        controls[ctrl.name] = ctrl;
                    },
                    removeControl: function (ctrl) {
                        this.removeError(ctrl.name);
                        delete controls[ctrl.name];
                        this.checkValidity();
                    },
                    setData: function (key, data) {
                        vm.$set(formName + '.' + key, data);
                    },
                    removeError: function (key) {
                        state.$error[key] = false;
                        delete state.$error[key];
                    },
                    checkValidity: function () {
                        var isValid = true;
                        Object.keys(controls).forEach(function (ctrl) {
                            if (controls[ctrl].state.$invalid) {
                                isValid = false;
                            }
                        });
                        this.setValidity(isValid);
                    },
                    setValidity: function (isValid) {
                        state.$valid = isValid;
                        state.$invalid = !isValid;
                        if (isValid) {
                            Vue.util.addClass(el, validClass);
                            Vue.util.removeClass(el, invalidClass);
                            removeClassWithPrefix(el, invalidClass + '-');
                        } else {
                            Vue.util.removeClass(el, validClass);
                            Vue.util.addClass(el, invalidClass);
                        }                        
                    },
                    setDirty: function () {
                        state.$dirty = true;
                        state.$pristine = false;
                        Vue.util.addClass(el, dirtyClass);
                        Vue.util.removeClass(el, pristineClass);
                    },
                    setPristine: function () {
                        state.$dirty = false;
                        state.$pristine = true;
                        Object.keys(controls).forEach(function (ctrl) {
                            controls[ctrl].setPristine();
                        });
                        vueForm.setSubmitted(false);
                        Vue.util.removeClass(el, dirtyClass);
                        Vue.util.addClass(el, pristineClass);
                    },
                    setSubmitted: function (isSubmitted) {
                        state.$submitted = isSubmitted;
                        if(isSubmitted) {
                            Vue.util.addClass(el, submittedClass);
                        } else {
                            Vue.util.removeClass(el, submittedClass);
                        }
                    }
                };
                
                if(hook) {
                    vm[hook](vueForm);
                }

                this._submitEvent = function () {
                    vueForm.setSubmitted(true);
                };
                Vue.util.on(el, 'submit', this._submitEvent);
            },
            update: function () {

            },
            unbind: function () {
                Vue.util.off(this.el, 'submit', this._submitEvent);
                delete this.el._vueForm;
            }
        });

        Vue.directive('formCtrl', {
            id: 'formCtrl',
            priority: 10000,
            bind: function () {
                var inputName = this.el.getAttribute('name'),
                    vModel = this.el.getAttribute('v-model'),
                    hook = this.el.getAttribute('hook'),
                    vm = this.vm,
                    el = this.el,
                    self = this,
                    vueForm;

                if (!inputName) {
                    console.warn('Name attribute must be populated');
                    return;
                }
                      
                var state = self._state = {
                    $name: inputName,
                    $dirty: false,
                    $pristine: true,
                    $valid: true,
                    $invalid: false,
                    $error: {}
                };

                var vueFormCtrl = el._vueFormCtrl = self._vueFormCtrl = {
                    el: el,
                    name: inputName,
                    state: state,
                    setVadility: function (key, isValid) {
                        var vueForm = self._vueForm;
                        state.$valid = isValid;
                        state.$invalid = !isValid;
                        if (isValid) {
                            vueForm.setData(inputName + '.$error.' + key, false);
                            delete state.$error[key];
                            vueForm.removeError(inputName);
                            Vue.util.addClass(el, validClass);
                            Vue.util.removeClass(el, invalidClass);
                            removeClassWithPrefix(el, invalidClass + '-');
                        } else {
                            vueForm.setData(inputName + '.$error.' + key, true);
                            vueForm.setData('$error.' + inputName, state);
                            Vue.util.removeClass(el, validClass);
                            Vue.util.addClass(el, invalidClass);    
                            Vue.util.addClass(el, invalidClass + '-' + key);                         
                        }
                        vueForm.checkValidity();
                    },
                    setDirty: function () {                        
                        state.$dirty = true;
                        state.$pristine = false;
                        self._vueForm.setDirty();
                        Vue.util.addClass(el, dirtyClass);
                        Vue.util.removeClass(el, pristineClass);
                    },
                    setPristine: function () {
                        state.$dirty = false;
                        state.$pristine = true;
                        Vue.util.removeClass(el, dirtyClass);
                        Vue.util.addClass(el, pristineClass);    
                    },
                    validators: {},
                    error: {},
                    validate: function (value) {
                        var isValid = true,
                            self = this;

                        Object.keys(this.validators).forEach(function (validator) {
                            var args = [value];

                            if (self.validators[validator] === false) {
                                self.setVadility(validator, true);
                                return;
                            }

                            if (!self.validators[validator]) {
                                return;
                            }

                            if (validator === 'email') {
                                args.push(self.multiple);
                            } else if (attrsWithValue.indexOf(validator) !== -1) {
                                args.push(self[validator]);
                            }

                            if (!self.validators[validator].apply(this, args)) {
                                isValid = false;
                                self.setVadility(validator, false);
                            } else {
                                self.setVadility(validator, true);
                            }

                        });

                        return isValid;
                    }
                };  
                    
                // add to validators depending on element attributes 
                attrs.forEach(function (attr) {
                    checkAttribute(self, attr);
                });              
                
                // find parent form
                var form;
                if(el.form) {
                    init(el.form._vueForm);                                   
                } else {
                    // this is either a non form element node 
                    // or a detached node (inside v-if)
                    form = closest(el, 'form[name]');
                    if(form && form._vueForm) {
                        init(form._vueForm); 
                    } else {
                        // must be detached
                        Vue.nextTick(function () {
                            form = el.form || closest(el, 'form[name]');
                            init(form._vueForm);
                        }); 
                    }
                }
                
                function init(vueForm) {
                    if(!vueForm) {
                        return;
                    }
                    self._vueForm = vueForm;
                                   
                    // register the form control
                    vueForm.addControl(vueFormCtrl);                 
                                                                                                        
                    // set inital state
                    vueForm.setData(inputName, state);    
                    Vue.util.addClass(el, pristineClass); 
                    Vue.util.addClass(el, validClass);            
                             
                    var first = true;                             
                    if (vModel) {
                        self.vm.$watch(vModel, function (value, oldValue) {
                            if (!first) {
                                vueFormCtrl.setDirty();
                            }
                            first = false;
                            vueFormCtrl.validate(value);
                            self._value = value;
                        }, { immediate: true });
                    }
                    
                };
                
                if(hook) {
                    vm[hook](vueFormCtrl);
                }                

            },
            update: function (value, oldValue) {
                if (this._notfirst) {
                    this._vueFormCtrl.setDirty();                    
                }
                this._notfirst = true;
                this._vueFormCtrl.validate(value);
                this._value = value;
            },
            unbind: function () {
                this._vueForm.removeControl(this._vueFormCtrl);
                delete this.el._vueFormCtrl;
            }
        });

    }

if (typeof exports == "object") {
    module.exports = vueForm;
} else if (typeof define == "function" && define.amd) {
    define([], function () { return vueForm });
} else if (window.Vue) {
    window.vueForm = vueForm;
    Vue.use(vueForm);
}

})();
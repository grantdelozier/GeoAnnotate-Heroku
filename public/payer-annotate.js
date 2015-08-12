"use strict"

//var SpansObject;

var payerApplier;
var payerUnapplier;

var payerClass = "payer"
var annotationClasses = [payerClass]

function addPayer() {
    addFeature(payerClass, payerApplier)
}


function init() {
    commonInit()

    //SpansObject = Parse.Object.extend("NESpans");

    payerApplier = rangy.createClassApplier(payerClass, {
        elementAttributes: {onclick:"spanClick(this)"},
        normalize: false
    });

    payerUnapplier = rangy.createClassApplier(payerClass, {
        elementAttributes: {onclick:"spanClick(this)"},
        normalize: true
    });


    annotationClassesAndAppliers = [
        {clazz: payerClass, applier: payerApplier, unapplier: payerUnapplier}
    ]

    keyCodeActions = [
        {code: 65, action: addPayer},
        {code: 82, action: removeAnnotation}
    ]
}

// Set 4-space indentation for vi
// vi:sw=4

"use strict"

var isDocGeo = false

var VolTextObject
var annotationLayer
var programmaticMapChange = false

// Number of changes made to annotations, either adding or removing a span
// or adding/removing a geometry. Only really used to check whether non-zero.
var annotationChanges = 0
var selvol = "0"
var annotationClassesAndAppliers
var keyCodeActions

var recentLocations = []
var recentLocationsMaxLength = 10

var lastSelectedNode

$(document).ready(function() {
    // This handles selection in dataTable
    var table = $('#vol_table').DataTable();

    $('#vol_table tbody').on('click', 'tr', function() {
        checkVol(this, '#vol_table', SpansObject)
    } );
 
    // FIXME: What does this do?
    $('#button').click( function() {
        table.row('.selected').remove().draw( false )
    } );

    $("#col2text").on("cut paste", function(e) {
        e.preventDefault()
    })

    // Prevent changes in a content-editable div
    $("#col2text").get(0).addEventListener("keydown", function(e) {
        e = e || window.event;
        console.log("Key pressed: keyCode=" + e.keyCode +
                    " altKey=" + e.altKey +
                    " ctrlKey=" + e.ctrlKey +
                    " metaKey=" + e.metaKey +
                    " shiftKey=" + e.shiftKey)
        // Allow Cmd + z and Cmd + c
        var allowableKey = e.metaKey && (e.keyCode == 90 || e.keyCode == 67)
        // Allow arrow keys, home, end, pgup, pgdn
        if (!allowableKey && (e.keyCode < 33 || e.keyCode > 40))
            e.preventDefault()
        if (!e.altKey && !e.ctrlKey && !e.metaKey) {
            keyCodeActions.forEach(function(action) {
                if (e.keyCode == action.code)
                    action.action()
            })
        }
    }, true)

    // Remove selection CSS and active geometry when outside span
    $("#col2text").on("mouseup", function(e) {
        //console.log("Mouse Clicked in col2text: " + e.button)
        if (e.button == 0){
            if (getSelectionNodes().length == 0){
                if (lastSelectedNode){
                    removeSelectCSS(lastSelectedNode);
                    destroyMapFeatures();
                    lastSelectedNode = null;
                }
            }
        }
    })

    $("#latlong").on("keypress", function(e) {
        e = e || window.event
        //console.log("Mouse Clicked in col2text: " + e.button)
        if (e.keyCode == 13){
            setLatLong()
        }
    })

    window.addEventListener("beforeunload", function (e) {
        var confirmationMessage = 'It looks like you have been editing something. '
        confirmationMessage += 'If you leave before saving, your changes will be lost.'

        if (annotationChanges == 0) {
            return undefined
        }

        (e || window.event).returnValue = confirmationMessage //Gecko + IE
        return confirmationMessage //Gecko + Webkit, Safari, Chrome etc.
    })
} )

function getSelectionNodes() {
    var selectionRange = getSelectionRange()
    return getRangeNodes(selectionRange, annotationClasses)
}

function setSelectionToNode(node) {
    var range = rangy.createRange()
    range.selectNodeContents(node)
    var sel = rangy.getSelection()
    sel.setSingleRange(range)
}


// Save annotations in a serialized format.
function saveVolumeAnnotations(successcb) {
    // Fetch annotations
    var annotations = getAnnotations(annotationClasses)
    // Convert to an array of serialized annotations in the form "CLASS$START$END".
    var geometries = 0
    var serialAnnotations = annotations.map(function(ann) {
        var jsonmapfeats = getStoredMapFeatures(ann.node) || ""
        if (jsonmapfeats)
            geometries++
        return ann.node.className + "$" + ann.start + "$" + ann.end + "$" + jsonmapfeats
    })
    // Join to a single serialized string
    var serialString = serialAnnotations.join("|")
    var base64 = utf8ToB64(serialString);
    var parse_file = new Parse.File((annotUser + "-" + selvol +".txt"), { base64: base64 });
    // Save to Parse. First look for an existing entry for the user and volume.
    // If found, update it. Else create a new entry.
    var query = new Parse.Query(SpansObject)
    query.equalTo("user", annotUser)
    query.equalTo("vol", selvol)
    query.first().then(function(existing) {
        if (existing) {
            existing.set("spans", parse_file)
            return existing.save()
        } else {
            var spansObject = new SpansObject()
            return spansObject.save({"user":annotUser, "vol":selvol, "spans":parse_file})
        }
    }, savefailure("finding existing entry")
    ).then(savesuccess(function() {
        annotationChanges = 0
        logMessage("Saved " + annotations.length + " annotations (" +
                   geometries + " geometries)")
        if (successcb)
            successcb()
    }),
        savefailure("saving new or updating existing entry"))
}

// Called from HTML. Save annotations. If saved successfully, reset list of
// article changes.
function saveAnnotations(successcb) {
    if (annotUser != "Default") {
        saveVolumeAnnotations(successcb)
    } else {
        logMessage("Please select a non-default Annotator Name prior prior to saving")
    }
}

// Load volume annotations
function loadVolumeAnnotations(results) {
    var textDivNode = getTextNode()
    textDivNode.normalize()
    var textNode = textDivNode.childNodes[0]
    logMessage("Loading Annotations...")
    httpGet(results[0].get("spans").url(), function(spansText) {
        var spansSerialized = spansText.split("|")
        var spans = spansSerialized.map(function(span) {
            var splitSpan = span.split("$")
            var className = splitSpan[0]
            var start = splitSpan[1]
            var end = splitSpan[2]
            var jsonmapfeats = splitSpan[3]
            return {start: start, end: end, className: className, jsonmapfeats: jsonmapfeats}
        })
        spans.sort(function(a, b) { return b.start - a.start })
        var geometries = 0
        for (var i = 0; i < spans.length; i++) {
            var span = spans[i]
            if (span.start > textNode.length || span.end > textNode.length) {
                console.log("Skipped span [" + span.start + "," +
                    span.end + "] because > " + textNode.length)
            } else {
                var range = rangy.createRange()
                range.setStartAndEnd(textNode, span.start, span.end)
                annotationClassesAndAppliers.forEach(function(ca) {
                    if (span.className == ca.clazz) {
                        if (span.jsonmapfeats && ca.geoapplier) {
                            ca.geoapplier.applyToRange(range)
                            geometries++
                        } else {
                            ca.applier.applyToRange(range)
                        }
                    }
                })
                getRangeNodes(range, annotationClasses).forEach(function(node) {
                    if (span.jsonmapfeats)
                        setStoredMapFeatures(node, span.jsonmapfeats, false)
                })
            }
        }
        logMessage("Loaded " + spans.length + " annotations (" +
                  geometries + " geometries)")
    })
}

function nameChangeAnnotator() {
    var el = document.getElementById("selectUserAnnotator");
    annotUser = el.options[el.selectedIndex].innerHTML;
}

function removeAnnotationsUponLoad() {
    destroyMapFeatures()
    // We don't actually need to remove the individual spans because we
    // just overwrite the whole HTML.
    annotationChanges = 0
}

function removeAnnotation() {
    removeSelectCSS(lastSelectedNode)
    setSelectionToNode(lastSelectedNode)
    var selectionRange = getSelectionRange()
    if (overlapsAnnotation(selectionRange, true, annotationClasses))
        logMessage("Selection contains part of an annotation")
    else {
        var nodes = getRangeNodes(getSelectionRange())
        nodes.forEach(function(node) {
            annotationClassesAndAppliers.forEach(function(ca) {
               if (ca.clazz == node.className) {
                    ca.unapplier.undoToRange(makeRange(node))
               }
            })
        })
        lastSelectedNode = undefined
        annotationChanges++
    }
}

function addSelectCSS(node){
    node.setAttribute("select", "1")
}

function removeSelectCSS(node){
    node.removeAttribute("select")
}

// Clicked on an annotation. Set up the map to display the annotation's
// map features and add to recent locations.
function spanClick(element) {
    //setSelectionToNode(element)
    if (lastSelectedNode) {
        removeSelectCSS(lastSelectedNode)
    }
    lastSelectedNode = element
    addSelectCSS(lastSelectedNode)
    //if (jsonfeats && centroid) {
    //    addToRecentLocations(element, jsonfeats, centroid)
    //}
}

function submitPassword() {
    
}

function commonInit() {
    //VolTextObject = Parse.Object.extend("VolumeText");

    rangy.init();

    var table = $('#vol_table').DataTable()
    getVolTableRows(table)

}

// Set 4-space indentation for vi
// vi:sw=4

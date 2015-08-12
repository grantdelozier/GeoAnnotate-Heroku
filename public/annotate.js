"use strict"

var annotUser = "Default"

function htmlEscape(str) {
    return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}

function utf8ToB64(str) {
    return window.btoa(unescape(encodeURIComponent(str)))
}

function logMessage(mess) {
    $("#log").html(mess)
}

function getSelectionRange() {
    return rangy.getSelection().getRangeAt(0)
}

function endSession() {
    
}

// Return true if the range overlaps an annotation, i.e. the start or end
// of the range is contained within an annotation. This doesn't check the
// case where the start and end are in separate text nodes with annotations
// in between; that's handled separately by the callers. If `exactOK` is
// given, the function only returns true on a strictly partial overlap,
// not when the range completely contains an annotation and where one end
// is exactly at an edge of the annotation. `exactOK` is given when deleting
// an annotation, so we can delete an annotation we're exactly on.
// When adding, we don't want to allow this -- we should have no overlap at
// all. When `exactOK` is given, we basically look to see if we're in the
// iddle of an annotation (i.e. not pointing to the beginning or end of an
// annotation), and disallow that.
function overlapsAnnotation(range, exactOK, classes) {
    function containerIsAnnotationChild(container, offset) {
        // If we're not contained in a text-node child of an annotation node,
        // return false.
        if (container.nodeType != 3 || // not a text node
            classes.indexOf(container.parentNode.className) <= -1)
            return false
        if (!exactOK)
            return true
        // If exactOK, only return true if we're within (not at the edges of)
        // the text node.
        return offset > 0 && offset < container.length
    }
    // Otherwise, if the start or end is in an annotation text node,
    // we're overlapping.
    return (containerIsAnnotationChild(range.startContainer,
                                       range.startOffset) ||
        containerIsAnnotationChild(range.endContainer, range.endOffset))
}

// Return the nodes contained within the range.
// NOTE: Always check overlapsAnnotation() first.
// NOTE: Currently, this returns an empty array if we are
// entirely within a single annotation but not exactly on it.
// If classes undefined will get every class in range 
function getRangeNodes(range, classes) {
    // If the selection is entirely within a text node that's the child of
    // an annotation, return the annotation, because getNodes() won't find
    // the annotation.

    function matchesClasses(node){
        if (classes){
            return (classes.indexOf(node.className) > -1)
        }else{
            return true
        }
    }

    if (range.startContainer === range.endContainer &&
        range.startContainer.nodeType === 3 && // text node
        matchesClasses(range.startContainer.parentNode))
        return [range.startContainer.parentNode]
    // If the selection is exactly on a single annotation, getNodes() doesn't
    // seem to find it, either, which is a bug; check for this case as well.
    if (range.startContainer === range.endContainer &&
        range.startContainer.nodeType === 1 && // element node
        matchesClasses(range.startContainer))
        return [range.startContainer]
    return range.getNodes(false, function(node) {
      return (matchesClasses(node))
    })
    
}

function makeRange(node) {
    var range = rangy.createRange()
    range.selectNode(node)
    return range
}

function getTextNode() {
    return document.getElementById('col2text')
}

// Return an array of annotations as character offsets, where each annotation
// is an object containing 'start', 'end' and 'node' properties
function getAnnotationsFast(classes) {
    var annotations = []
    function getAnnotationsFast1(node, classes, inclasses, offset) {
        if (node.nodeType == 3) {
            if (inclasses) {
                annotations.push({start: offset, end: offset + node.length,
                    node: node.parentNode})
                // console.log("[" + offset + "," + (offset + node.length) + "]")
            }
            return offset + node.length
        }
        if (node.nodeType == 1) {
            if (classes.indexOf(node.className) > -1)
                inclasses = true
            for (var i = 0; i < node.childNodes.length; i++) {
                offset = getAnnotationsFast1(node.childNodes[i], classes,
                    inclasses, offset)
            }
            return offset
        }
        return offset
    }

    getAnnotationsFast1(getTextNode(), classes, false, 0)
    return annotations
}

// Return an array of annotations as character offsets, where each annotation
// is an object containing 'start', 'end' and 'node' properties
function getAnnotationsSlow(classes) {
    var nodes = getRangeNodes(makeRange(document.body), classes)
    var textNode = getTextNode()
    //debugger;
    var ne_annotations = nodes.map(function(node) {
        var range = makeRange(node).toCharacterRange(textNode)
        return {start:range.start, end:range.end, node:node}
    })
    return ne_annotations
}

function getAnnotations(classes) {
    return getAnnotationsFast(classes)
}

function addAnnotation(clazz, applier) {
    //debugger;
    var selectionRange = getSelectionRange()
    if (selectionRange.startOffset != selectionRange.endOffset) {
        if (overlapsAnnotation(selectionRange, false, [clazz])) {
            logMessage("Selection already contains part of an annotation")
            return false
        } else {
            var nodes = getRangeNodes(selectionRange, [clazz])
            if (nodes.length > 0) {
                logMessage("Selection already contains an annotation")
                return false
            } else {
                applier.applyToSelection()
                annotationChanges++
                logMessage("Added a " + clazz + " span")
                return true
            }
        }
    }
}

// Function that returns a callback function meant to be called upon
// successful save in a Parse operation. SUCCESSCB is a callback passed
// in by the user to be executed by the returned callback, which also logs
// a save message.
function savesuccess(successcb) {
    return function(obj) {
        console.log("Saved volume " + selvol + " for user " + annotUser)
        if (successcb)
            successcb()
    }
}

// Function that returns a callback function meant to be called as a failure
// callback from a Parse operation. The OPERATION argument, if given,
// specifies the operation during which the failure occurred and will appear
// in the message.
function savefailure(operation) {
    return function(error) {
        window.alert("Failure saving volume " + selvol + " for user " + annotUser +
                     (operation ? " during " + operation : "") + ": " + error.message +
                     " (" + error.code + ")")
    }
}

function httpGet(theUrl, callback)
{
    var xmlhttp=new XMLHttpRequest();
    
    xmlhttp.onreadystatechange=function()
    {
        if (xmlhttp.readyState==4 && xmlhttp.status==200)
        {
            //console.log(xmlhttp)
            callback(xmlhttp.responseText);
        }
    }
    //console.log(theUrl)
    xmlhttp.open("GET", theUrl, false);
    try {
    xmlhttp.send();
    }
    catch(err){
        window.alert("Failure loading URL " + theUrl + " : " + err.message)
    }    
}

function loadVolumeText(vol, spansObject) {
    removeAnnotationsUponLoad()
    logMessage("Loading annotations ...")
    selvol = vol
    //var query = new Parse.Query(VolTextObject)
    query.equalTo("vol", vol)
    query.find().then(function(results) {
        //console.log("Successfully " + results[0].get["text"))
        httpGet(results[0].get("text").url(), function(text){
            $("#col2text").html(htmlEscape(text))
            var q2 = new Parse.Query(spansObject)
            q2.equalTo("user", annotUser)
            q2.equalTo("vol", vol)
            q2.find().then(function(results2) {
                if (results2.length > 0) {
                    // loadAnnotations(results)
                    // loadAnnotationsXML(results)
                    loadVolumeAnnotations(results2)
                } else {
                    logMessage("No annotations in volume for this annotator")
                }
            });
        })
        //debugger;
        //return Parse.Cloud.httpRequest({ url: results[0].get("text").url() })
    })
}

function getVolTableRows(table){
    //var query = new Parse.Query(VolTextObject)
    /*query.exists("vol")
    query.limit(1000)
    query.find().then(function(results) {
        //console.log("Successfully " + results[0].get["text"))
        //$("#col2text").html(results[0].get("text"))
        for (var i = 0; i < results.length; i++) {
            var vol = results[i].get("vol")
            var descrip = results[i].get("description")
            table.row.add([vol, descrip]).draw();
        }
    })*/
    //Replace parse query with http based postgres query
    table.row.add(["Default Vol", "Descrip"]).draw();
}

function checkVol(row, tableSelector, spansObject) {
    function closeDialog(node) {
        $(node).dialog("close")
    }

    function selectNewRow() {
        if ($(row).hasClass('selected')) {
            $(row).removeClass('selected')
        }
        else {
            table.$('tr.selected').removeClass('selected')
            $(row).addClass('selected')
        }
    }

    var table = $(tableSelector).DataTable()
 
    if (annotUser != "Default") {
        var ret = table.$(row)
        if (ret.length > 0) {
            var newvol = ret.find('td:first').text()
            if (annotationChanges > 0) {
                $('<div>Do you want to save the existing annotations?</div>').dialog({
                    resizable: false,
                    modal: true,
                    buttons: {
                        "Yes": function() {
                            saveAnnotations(function() {
                                loadVolumeText(newvol, spansObject)
                                selectNewRow()
                            })
                            closeDialog(this)
                        },
                        "No": function() {
                            loadVolumeText(newvol, spansObject)
                            selectNewRow()
                            closeDialog(this)
                        },
                        "Cancel": function() {
                            logMessage("Canceled")
                            closeDialog(this)
                        }
                    }
                })
            } else {
                loadVolumeText(newvol, spansObject)
                selectNewRow()
            }
        }
    } else {
        logMessage("Please select a non-default Annotator name prior to loading a volume")
    }
}

// Set 4-space indentation for vi
// vi:sw=4

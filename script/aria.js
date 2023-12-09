
/**
 * Clones a node but strips IDs
 * @param {HTMLElement} node - an element node
 * @returns {HTMLElement} - cloned node without IDs
 */
function cloneWithoutIds(node) {
    const clone = node.cloneNode(true);
    for (const elementWithId of clone.querySelectorAll("[id]")) {
        elementWithId.removeAttribute("id");
    }
    return clone;
}

/**
 * roleInfo is structured like this:
 *
 * name: the name of the role
 * fragID: the @id for the role in the document
 * parentRoles: roles from which it inherits
 * localprops: local properties and states
 */

const roleInfo = {};

/**
 * temporary refactoring to keep things legible
 * @param {Object} propList -
 * @param {Object} globalSP -
 * @param {HTMLElement} item - from nodeList.forEach
 */
const handleStatesAndProperties = function (propList, globalSP, item) {
    const type = item.localName === "pdef" ? "property" : "state";
    const container = item.parentNode;
    const content = item.innerHTML;
    const title = item.getAttribute("title") || content;
    const dRef = item.nextElementSibling;
    const desc = cloneWithoutIds(dRef.firstElementChild).innerHTML;
    dRef.id = "desc-" + title;
    dRef.setAttribute("role", "definition");
    // add this item to the index
    propList[title] = {
        is: type,
        title: title,
        name: content,
        desc: desc,
        roles: [],
    };
    // Replace pdef/sdef with HTML
    item.insertAdjacentHTML(
        "afterend",
        `<h4><span class="${type}-name" title="${title}" aria-describedby="desc-${title}"><code>${content}</code> <span class="type-indicator">${type}</span></span></h4>`
    );
    item.remove();
    // Populate globalSP
    const applicabilityText = container.querySelector(
        "." + type + "-applicability"
    ).innerText;
    const isDefault = applicabilityText === "All elements of the base markup";
    const isProhibited =
        applicabilityText ===
        "All elements of the base markup except for some roles or elements that prohibit its use";
    const isDeprecated =
        applicabilityText === "Use as a global deprecated in ARIA 1.2";
    // NOTE: the only other value for applicabilityText appears to be "Placeholder"
    if (isDefault || isProhibited || isDeprecated) {
        globalSP.push({
            is: type,
            title: title,
            name: content,
            desc: desc,
            prohibited: isProhibited,
            deprecated: isDeprecated,
        });
    }

    // if we are in a div, convert that div to a section
    // TODO:
    // a) seems to be always the case.
    // b) Why don't we author the spec this way?
    if (container.nodeName.toLowerCase() == "div") {
        // change the enclosing DIV to a section with notoc
        const sec = document.createElement("section");
        [...container.attributes].forEach(function (attr) {
            sec.setAttribute(attr.name, attr.value);
        });
        sec.classList.add("notoc");
        const theContents = container.innerHTML;
        sec.innerHTML = theContents;
        container.parentNode.replaceChild(sec, container);
    }
};

function ariaAttributeReferences() {
    const propList = {};
    const globalSP = [];

    let skipIndex = 0;
    const myURL = document.URL;
    if (myURL.match(/\?fast/)) {
        skipIndex = 1;
    }

    // process the document before anything else is done
    // first get the properties
    document
        .querySelectorAll("pdef, sdef")
        .forEach(handleStatesAndProperties.bind(null, propList, globalSP));

    if (!skipIndex) {
        // Generate index of states and properties
        const indexStatePropPlaceholder =
            document.getElementById("index_state_prop");
        const indexStatePropContent = Object.values(propList)
            .map(
                (item) =>
                    `<dt><a href="#${item.title}" class="${item.is}-reference">${item.name}</a></dt>\n<dd>${item.desc}</dd>\n`
            )
            .join("");
        indexStatePropPlaceholder.insertAdjacentHTML(
            "afterend",
            `<dl id="index_state_prop" class="compact">${indexStatePropContent}</dl>`
        );
        indexStatePropPlaceholder.remove();

        // Generate index of global states and properties
        // TODO: consider moving "(state)" out of sref/pref; then maybe remove title attr for sref (after checking resolveReferences interference)
        const globalStatesPropertiesContent = globalSP
            .map((item) => {
                const isState = item.is === "state";
                const tagName = isState ? "sref" : "pref";
                return `<li><${tagName} ${
                    item.prohibited ? "data-prohibited " : ""
                }${item.deprecated ? "data-deprecated " : ""}${
                    isState ? `title="${item.name}"` : ""
                }>${item.name}${isState ? " (state)" : ""}</${tagName}>${
                    item.prohibited ? " (Except where prohibited)" : ""
                }${
                    item.deprecated
                        ? " (Global use deprecated in ARIA 1.2)"
                        : ""
                }</li>\n`;
            })
            .join("");
        const globalStatesPropertiesPlaceholder = document.querySelector(
            "#global_states .placeholder"
        );
        globalStatesPropertiesPlaceholder.insertAdjacentHTML(
            "afterend",
            `<ul>${globalStatesPropertiesContent}</ul>`
        );
        globalStatesPropertiesPlaceholder.remove();

        // Populate role=roletype properties with global properties
        const roletypePropsPlaceholder = document.querySelector(
            "#roletype td.role-properties span.placeholder"
        );
        roletypePropsPlaceholder.insertAdjacentHTML(
            "afterend",
            `<ul>${globalStatesPropertiesContent}</ul>`
        );
        roletypePropsPlaceholder.remove();
    }

    // what about roles?
    //
    // we need to do a few things here:
    //   1. expand the rdef elements.
    //   2. accumulate the roles into a table for the indices
    //   3. grab the parent role reference so we can build up the tree
    //   4. grab any local states and properties so we can hand those down to the children
    //

    const subRoles = [];
    let roleIndex = "";
    let fromAuthor = "";
    let fromHeading = "";
    let fromContent = "";
    let fromProhibited = "";

    document.querySelectorAll("rdef").forEach(function (item) {
        const container = item.parentNode;
        const content = item.innerHTML;
        const sp = document.createElement("h4");
        let title = item.getAttribute("title");
        if (!title) {
            title = content;
        }

        const pnID = title;
        container.id = pnID;
        sp.className = "role-name";
        sp.title = title;
        // is this a role or an abstract role
        let type = "role";
        let isAbstract = false;
        const abstract = container.querySelectorAll(".role-abstract");
        if (abstract.innerText === "True") {
            type = "abstract role";
            isAbstract = true;
        }
        sp.innerHTML =
            "<code>" +
            content +
            '</code> <span class="type-indicator">' +
            type +
            "</span>";
        // sp.id = title;
        sp.setAttribute("aria-describedby", "desc-" + title);
        const dRef = item.nextElementSibling;
        const desc = cloneWithoutIds(dRef.firstElementChild).innerHTML;
        dRef.id = "desc-" + title;
        dRef.setAttribute("role", "definition");
        container.replaceChild(sp, item);
        roleIndex +=
            '<dt><a href="#' +
            pnID +
            '" class="role-reference"><code>' +
            content +
            "</code>" +
            (isAbstract ? " (abstract role) " : "") +
            "</a></dt>\n";
        roleIndex += "<dd>" + desc + "</dd>\n";
        // grab info about this role
        // do we have a parent class?  if so, put us in that parents list
        const node = container.querySelectorAll(".role-parent rref");
        // s will hold the name of the parent role if any
        let s = null;
        const parentRoles = [];
        if (node.length) {
            node.forEach(function (roleref) {
                s = roleref.textContent || roleref.innerText;

                if (!subRoles[s]) {
                    subRoles.push(s);
                    subRoles[s] = [];
                }
                subRoles[s].push(title);
                parentRoles.push(s);
            });
        }
        // are there supported states / properties in this role?
        const attrs = [];
        container
            .querySelectorAll(
                ".role-properties, .role-required-properties, .role-disallowed"
            )
            .forEach(function (node) {
                if (
                    node &&
                    ((node.textContent && node.textContent.length !== 1) ||
                        (node.innerText && node.innerText.length !== 1))
                ) {
                    // looks like we do
                    node.querySelectorAll("pref,sref").forEach(function (item) {
                        let name = item.getAttribute("title");
                        if (!name) {
                            name = item.textContent || item.innerText;
                        }
                        const type =
                            item.localName === "pref" ? "property" : "state";
                        const req = node.classList.contains(
                            "role-required-properties"
                        );
                        const dis = node.classList.contains("role-disallowed");
                        const dep = item.hasAttribute("data-deprecated");
                        attrs.push({
                            is: type,
                            name: name,
                            required: req,
                            disallowed: dis,
                            deprecated: dep,
                        });

                        // remember that the state or property is
                        // referenced by this role
                        propList[name].roles.push(title);
                    });
                }
            });
        roleInfo[title] = {
            name: title,
            fragID: pnID,
            parentRoles: parentRoles,
            localprops: attrs,
        };

        // is there a namefrom indication?  If so, add this one to
        // the list
        if (!isAbstract) {
            container
                .querySelectorAll(".role-namefrom")
                .forEach(function (node) {
                    const reqRef =
                        container.querySelector(".role-namerequired");
                    let req = "";
                    if (reqRef && reqRef.innerText === "True") {
                        req = " (name required)";
                    }

                    if (node.textContent.indexOf("author") !== -1) {
                        fromAuthor +=
                            '<li><a href="#' +
                            pnID +
                            '" class="role-reference"><code>' +
                            content +
                            "</code></a>" +
                            req +
                            "</li>";
                    }
                    if (node.textContent.indexOf("heading") !== -1) {
                        fromHeading +=
                            '<li><a href="#' +
                            pnID +
                            '" class="role-reference"><code>' +
                            content +
                            "</code></a>" +
                            req +
                            "</li>";
                    }
                    if (
                        !isAbstract &&
                        node.textContent.indexOf("content") !== -1
                    ) {
                        fromContent +=
                            '<li><a href="#' +
                            pnID +
                            '" class="role-reference"><code>' +
                            content +
                            "</code></a>" +
                            req +
                            "</li>";
                    }
                    if (node.textContent.indexOf("prohibited") !== -1) {
                        fromProhibited +=
                            '<li><a href="#' +
                            pnID +
                            '" class="role-reference"><code>' +
                            content +
                            "</code></a>" +
                            req +
                            "</li>";
                    }
                });
        }
        if (container.nodeName.toLowerCase() == "div") {
            // change the enclosing DIV to a section with notoc
            const sec = document.createElement("section");
            [...container.attributes].forEach(function (attr) {
                sec.setAttribute(attr.name, attr.value);
            });

            sec.classList.add("notoc");
            const theContents = container.innerHTML;
            sec.innerHTML = theContents;
            container.parentNode.replaceChild(sec, container);
        }
    });

    const getStates = function (role) {
        const ref = roleInfo[role];
        if (!ref) {
            msg.pub("error", "No role definition for " + role);
        } else if (ref.allprops) {
            return ref.allprops;
        } else {
            let myList = ref.localprops;
            ref.parentRoles.forEach(function (item) {
                const pList = getStates(item);
                myList = myList.concat(pList);
            });
            ref.allprops = myList;
            return myList;
        }
    };

    // TODO: test this on a page where `skipIndex` is truthy
    if (!skipIndex) {
        // build up the complete inherited SP lists for each role
        // however, if the role already specifies an item, do not include it
        Object.entries(roleInfo).forEach(function (index) {
            const item = index[1];
            let output = "";
            const placeholder = document.querySelector(
                "#" + item.fragID + " .role-inherited"
            );

            if (placeholder) {
                let myList = [];
                item.parentRoles.forEach(function (role) {
                    myList = myList.concat(getStates(role));
                });
                // strip out any items that we have locally
                if (item.localprops.length && myList.length) {
                    for (let j = myList.length - 1; j >= 0; j--) {
                        item.localprops.forEach(function (x) {
                            if (x.name == myList[j].name) {
                                myList.splice(j, 1);
                            }
                        });
                    }
                }

                const reducedList = myList.reduce((uniqueList, item) => {
                    return uniqueList.includes(item)
                        ? uniqueList
                        : [...uniqueList, item];
                }, []);

                const sortedList = reducedList.sort((a, b) => {
                    if (a.name == b.name) {
                        // Ensure deprecated false properties occur first
                        if (a.deprecated !== b.deprecated) {
                            return a.deprecated ? 1 : b.deprecated ? -1 : 0;
                        }
                    }
                    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
                }, []);

                let prev;
                for (let k = 0; k < sortedList.length; k++) {
                    const property = sortedList[k];
                    let req = "";
                    let dep = "";
                    if (property.required) {
                        req = " <strong>(required)</strong>";
                    }
                    if (property.deprecated) {
                        dep =
                            " <strong>(deprecated on this role in ARIA 1.2)</strong>";
                    }
                    if (prev != property.name) {
                        output += "<li>";
                        if (property.is === "state") {
                            output +=
                                "<sref>" +
                                property.name +
                                "</sref> (state)" +
                                req +
                                dep;
                        } else {
                            output +=
                                "<pref>" +
                                property.name +
                                "</pref>" +
                                req +
                                dep;
                        }
                        output += "</li>\n";
                        prev = property.name;
                    }
                }
                if (output !== "") {
                    output = "<ul>\n" + output + "</ul>\n";
                    placeholder.innerHTML = output;
                }
            }
        });

        // Update state and property role references
        const getAllSubRoles = function (role) {
            const ref = subRoles[role];
            if (ref && ref.length) {
                let myList = [];
                ref.forEach(function (item) {
                    if (!myList.item) {
                        myList[item] = 1;
                        myList.push(item);
                        const childList = getAllSubRoles(item);
                        myList = myList.concat(childList);
                    }
                });
                return myList;
            } else {
                return [];
            }
        };

        Object.entries(propList).forEach(function (index) {
            let output = "";
            const item = index[1];
            const section = document.querySelector("#" + item.name);
            let placeholder = section.querySelector(
                ".state-applicability, .property-applicability"
            );
            if (
                placeholder &&
                (placeholder.textContent || placeholder.innerText) ===
                    "Placeholder" &&
                item.roles.length
            ) {
                // update the used in roles list
                let sortedList = [];
                sortedList = item.roles.sort();
                for (let j = 0; j < sortedList.length; j++) {
                    output += "<li><rref>" + sortedList[j] + "</rref></li>\n";
                }
                if (output !== "") {
                    output = "<ul>\n" + output + "</ul>\n";
                }
                placeholder.innerHTML = output;
                // also update any inherited roles
                let myList = [];
                item.roles.forEach(function (role) {
                    let children = getAllSubRoles(role);
                    // Some subroles have required properties which are also required by the superclass.
                    // Example: The checked state of radio, which is also required by superclass checkbox.
                    // We only want to include these one time, so filter out the subroles.
                    children = children.filter(function (subrole) {
                        return (
                            subrole.indexOf(propList[item.name].roles) === -1
                        );
                    });
                    myList = myList.concat(children);
                });
                placeholder = section.querySelector(
                    ".state-descendants, .property-descendants"
                );
                if (placeholder && myList.length) {
                    sortedList = myList.sort();
                    output = "";
                    let last = "";
                    for (let j = 0; j < sortedList.length; j++) {
                        var sItem = sortedList[j];
                        if (last != sItem) {
                            output += "<li><rref>" + sItem + "</rref></li>\n";
                            last = sItem;
                        }
                    }
                    if (output !== "") {
                        output = "<ul>\n" + output + "</ul>\n";
                    }
                    placeholder.innerHTML = output;
                }
            } else if (
                placeholder &&
                (placeholder.textContent || placeholder.innerText) ===
                    "Use as a global deprecated in ARIA 1.2" &&
                item.roles.length
            ) {
                // update the used in roles list
                let sortedList = [];
                sortedList = item.roles.sort();
                //remove roletype from the sorted list
                const index = sortedList.indexOf("roletype");
                if (index > -1) {
                    sortedList.splice(index, 1);
                }

                for (let j = 0; j < sortedList.length; j++) {
                    output += "<li><rref>" + sortedList[j] + "</rref></li>\n";
                }
                if (output !== "") {
                    output = "<ul>\n" + output + "</ul>\n";
                }
                placeholder.innerHTML = output;
                // also update any inherited roles
                let myList = [];
                item.roles.forEach(function (role) {
                    let children = getAllSubRoles(role);
                    // Some subroles have required properties which are also required by the superclass.
                    // Example: The checked state of radio, which is also required by superclass checkbox.
                    // We only want to include these one time, so filter out the subroles.
                    children = children.filter(function (subrole) {
                        return (
                            subrole.indexOf(propList[item.name].roles) === -1
                        );
                    });
                    myList = myList.concat(children);
                });
                placeholder = section.querySelector(
                    ".state-descendants, .property-descendants"
                );
                if (placeholder && myList.length) {
                    let sortedList = myList.sort();
                    let output = "";
                    let last = "";
                    for (j = 0; j < sortedList.length; j++) {
                        const sItem = sortedList[j];
                        if (last != sItem) {
                            output += "<li><rref>" + sItem + "</rref></li>\n";
                            last = sItem;
                        }
                    }
                    if (output !== "") {
                        output = "<ul>\n" + output + "</ul>\n";
                    }
                    placeholder.innerHTML = output;
                }
            } else if (
                placeholder &&
                (placeholder.textContent || placeholder.innerText) ===
                    "All elements of the base markup except for some roles or elements that prohibit its use" &&
                item.roles.length
            ) {
                // for prohibited roles the roles list just includes those roles which are prohibited... weird I know but it is what it is
                let sortedList = [];
                sortedList = item.roles.sort();
                //remove roletype from the sorted list
                const index = sortedList.indexOf("roletype");
                if (index > -1) {
                    sortedList.splice(index, 1);
                }
                output +=
                    "All elements of the base markup except for the following roles: ";
                for (let j = 0; j < sortedList.length - 1; j++) {
                    output += "<rref>" + sortedList[j] + "</rref>, ";
                }
                output +=
                    "<rref>" + sortedList[sortedList.length - 1] + "</rref>";
                placeholder.innerHTML = output;
            }
        });

        // spit out the index
        let node = document.getElementById("index_role");
        let parentNode = node.parentNode;
        let list = document.createElement("dl");
        list.id = "index_role";
        list.className = "compact";
        list.innerHTML = roleIndex;
        parentNode.replaceChild(list, node);

        // and the namefrom lists
        node = document.getElementById("index_fromauthor");
        if (node) {
            parentNode = node.parentNode;
            list = document.createElement("ul");
            list.id = "index_fromauthor";
            list.className = "compact";
            list.innerHTML = fromAuthor;
            parentNode.replaceChild(list, node);
        }

        node = document.getElementById("index_fromheading");
        if (node) {
            parentNode = node.parentNode;
            list = document.createElement("ul");
            list.id = "index_fromheading";
            list.className = "compact";
            list.innerHTML = fromHeading;
            parentNode.replaceChild(list, node);
        }

        node = document.getElementById("index_fromcontent");
        if (node) {
            parentNode = node.parentNode;
            list = document.createElement("ul");
            list.id = "index_fromcontent";
            list.className = "compact";
            list.innerHTML = fromContent;
            parentNode.replaceChild(list, node);
        }

        node = document.getElementById("index_fromprohibited");
        if (node) {
            parentNode = node.parentNode;
            list = document.createElement("ul");
            list.id = "index_fromprohibited";
            list.className = "compact";
            list.innerHTML = fromProhibited;
            parentNode.replaceChild(list, node);
        }
        // assuming we found some parent roles, update those parents with their children
        for (let i = 0; i < subRoles.length; i++) {
            const item = subRoles[subRoles[i]];
            const sortedList = item.sort(function (a, b) {
                return a < b ? -1 : a > b ? 1 : 0;
            });
            let output = "<ul>\n";
            for (let j = 0; j < sortedList.length; j++) {
                output += "<li><rref>" + sortedList[j] + "</rref></li>\n";
            }
            output += "</ul>\n";
            // put it somewhere
            const subRolesContainer = document.querySelector("#" + subRoles[i]);
            if (subRolesContainer) {
                const subRolesListContainer =
                    subRolesContainer.querySelector(".role-children");
                if (subRolesListContainer) {
                    subRolesListContainer.innerHTML = output;
                }
            }
        }
    }

    // prune out unused rows throughout the document
    document
        .querySelectorAll(
            ".role-abstract, .role-parent, .role-base, .role-related, .role-scope, .role-mustcontain, .role-required-properties, .role-properties, .role-namefrom, .role-namerequired, .role-namerequired-inherited, .role-childpresentational, .role-presentational-inherited, .state-related, .property-related,.role-inherited, .role-children, .property-descendants, .state-descendants, .implicit-values"
        )
        .forEach(function (item) {
            var content = item.innerText;
            if (content.length === 1 || content.length === 0) {
                // there is no item - remove the row
                item.parentNode.parentNode.removeChild(item.parentNode);
            } else if (
                content === "Placeholder" &&
                !skipIndex &&
                (item.className === "role-inherited" ||
                    item.className === "role-children" ||
                    item.className === "property-descendants" ||
                    item.className === "state-descendants")
            ) {
                item.parentNode.remove();
            }
        });

    updateReferences(document);
}

require(["core/pubsubhub"], function (respecEvents) {
    const button = respecUI.addCommand(
        "Save roles as JSON",
        showAriaSave,
        null,
        "☁️"
    );

    function showAriaSave() {
        const json = JSON.stringify(roleInfo, null, "  ");
        const href =
            "data:text/html;charset=utf-8," +
            "/* This file is generated - do not modify */\nvar roleInfo = " +
            encodeURIComponent(json);
        const ariaUI = document.createElement("div");
        ariaUI.classList.add("respec-save-buttons");
        ariaUI.innerHTML = `
        <a href="${href}" download="roleInfo.json" class="respec-save-button">Save JSON</a>
      `;
        respecUI.freshModal("Save Aria roles as JSON", ariaUI, button);
        ariaUI.querySelector("a").focus();
    }
    respecEvents.sub("end", function (msg) {
        if (msg == "w3c/conformance") {
            ariaAttributeReferences();
        }
    });
});

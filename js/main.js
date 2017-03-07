new Promise((resolve, reject) => {
  window.onload = resolve;
}).then(() => {
  return fetch("assets/elements.db")
}).then((response) => {
  if(!response.ok) {
    return Promise.reject("Could not fetch elements database: " + response.status + " " + response.statusText);
  }
  return response.arrayBuffer();
}).then((ab) => {
  let data = new Uint8Array(ab);
  let db = new SQL.Database(data);
  console.log("Loaded database, populating elements");

  let container = document.getElementById("elementsContainer");
  
  let result = db.exec("SELECT * FROM elements ORDER BY atomic_number")[0];
  let oxiStatesStmt = db.prepare("SELECT oxidation_state FROM oxidationstates WHERE atomic_number=:an");

  let seriesStmt = db.prepare("SELECT name FROM series WHERE id=:sid");
  let elements = [];

  let rowToObject = (row, columns) => {
    let obj = {};
    for(let i = 0; i < columns.length; i++) {
      obj[columns[i]] = row[i];
    }
    return obj;
  };

  let bindFieldSimple = (value) => {
    let td = document.createElement("td");
    td.textContent = value;
    return td;
  };

  let bindFieldLink = (value) => {
    let td = document.createElement("td");
    let a = document.createElement("a");
    a.href = value;
    a.textContent = value;
    td.appendChild(a);
    return td;
  };
  
  for(let i = 0; i < result.values.length; i++) {
    let element = rowToObject(result.values[i], result.columns);
    
    let tr = document.createElement("tr");

    let thumbContainer = document.createElement("td");
    tr.appendChild(thumbContainer);
    
    tr.appendChild(bindFieldSimple(element.atomic_number));
    tr.appendChild(bindFieldSimple(element.atomic_weight));
    tr.appendChild(bindFieldSimple(element.symbol));
    tr.appendChild(bindFieldSimple(element.name));
    tr.appendChild(bindFieldSimple(seriesStmt.getAsObject({":sid": element.series_id}).name));
    
    let oxiStates = document.createElement("td");
    oxiStatesStmt.bind([element.atomic_number]);
    let oxiStatesList = [];
    while(oxiStatesStmt.step()) {
      oxiStatesList.push(oxiStatesStmt.get()[0]);
    }
    oxiStates.textContent = oxiStatesList.map((n) => n > 0 ? "+" + n : n).join(", ");
    tr.appendChild(oxiStates);

    tr.appendChild(bindFieldLink("https://en.wikipedia.org/wiki/" + element.name));
    
    container.appendChild(tr);

    elements.push({
      element,
      tr,
      thumbContainer
    });
  }

  console.log("Grabbing thumbnails from Wikipedia...");
  let groups = elements.reduce((acc, val) => {
    if(acc[acc.length-1].length >= 50) {
      acc.push([val]);
    } else {
      acc[acc.length-1].push(val);
    }
    return acc;
  }, [[]]);
  
  let recurse = (groups, i) => {
    if(i >= groups.length) {
      console.log("reached end of recursion");
      return Promise.resolve();
    }
    console.log("recurse " + i);
    return fetch("https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&pithumbsize=100&pilimit=50&origin=*&titles=" + groups[i].map((obj) => obj.element.name).join("|")).then((response) => {
      if(!response.ok) {
        return Promise.reject(response.status + " " + response.statusCode);
      }
      return response.json();
    }).then((json) => {
      for(let key in json.query.pages) {
        let page = json.query.pages[key];
        if(page.thumbnail) {
          let element = groups[i].find((element) => element.element.name == page.title);
          let img = document.createElement("img");
          img.src = page.thumbnail.source;
          element.thumbContainer.appendChild(img);
        }
      }
      console.log("recursing further");
      return recurse(groups, i + 1);
    });
  };
  recurse(groups, 0);

  console.log("Rigging up search box...");
  let sbox = document.getElementById("searchbox");
  sbox.focus();

  let sort = () => {
    let search = sbox.value;
    if(search == "") {
      while(container.hasChildNodes()) {
        container.removeChild(container.firstChild);
      }
      elements.sort((a, b) => {
        return a.element.atomic_number - b.element.atomic_number;
      });
      elements.forEach((element) => {
        element.tr.className = "";
        container.appendChild(element.tr);
      });
    } else {
      while(container.hasChildNodes()) {
        container.removeChild(container.firstChild);
      }
      elements.sort((a, b) => {
        if(a.element.symbol.toLowerCase() == search.toLowerCase()) {
          return -1;
        }
        if(b.element.symbol.toLowerCase() == search.toLowerCase()) {
          return 1;
        }
        return a.element.atomic_number - b.element.atomic_number;
      });
      elements.forEach((obj) => {
        let {element, tr} = obj;
        if(element.name.toLowerCase().includes(search.toLowerCase()) || element.symbol.toLowerCase().includes(search.toLowerCase())) {
          tr.className = "";
          container.appendChild(tr);
        } else {
          tr.className = "hidden";
        }
      });
    }
  };
  sbox.addEventListener("input", sort);
  sort();
});

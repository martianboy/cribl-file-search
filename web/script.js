let filePopover = null;
let serversPopover = null;

function performSearch(e) {
  e.preventDefault();

  if (!filePopover) {
    console.error('File popover not initialized');
    return;
  }

  const { file, limit } = filePopover.value;
  if (!file) {
    filePopover.focus();
    return;
  }

  const term = document.getElementById('term').value;

  fetchResults(file, term, limit);
}

function initSearchForm() {
  const limit = document.getElementById('limit');
  limit.value = 100;

  document
    .getElementById('search-form')
    .addEventListener('submit', performSearch);
}

function initPopover(parent) {
  const button = parent.querySelector('.popover-button');
  const container = parent.querySelector('.popover-container');

  const controller = {
    toggle() {
      button.classList.toggle('opened');
      container.classList.toggle('opened');
    },
    open() {
      button.classList.add('opened');
      container.classList.add('opened');
    },
    close() {
      button.classList.remove('opened');
      container.classList.remove('opened');
    },
    setButtonLabel(label) {
      button.textContent = label;
    },

    get components() {
      return {
        button,
        container,
      };
    },
  };

  button.addEventListener('click', controller.toggle);

  return controller;
}

function initFilePopover() {
  const filePopover = initPopover(document.getElementById('file-popover'));
  const { container } = filePopover.components;
  const closeButton = container.querySelector('.popover-close');

  const file = container.querySelector('#file');
  const limit = container.querySelector('#limit');

  closeButton.addEventListener('click', function () {
    if (file.value === '') {
      file.focus();
    } else {
      filePopover.setButtonLabel(file.value);
      filePopover.close();
    }
  });

  return {
    open() {
      filePopover.open();
    },
    close() {
      filePopover.close();
    },
    focus() {
      file.focus();
    },
    get value() {
      return {
        file: file.value,
        limit: limit.value,
      };
    },
  };
}

function fetchResults(file, term, limit) {
  const queryParams = new URLSearchParams({ file });
  if (term) {
    queryParams.set('term', term);
  }
  if (limit) {
    queryParams.set('limit', limit);
  }

  const endpoint =
    serversPopover.value === 'all' ? '/search-all' : '/search-server';

  if (serversPopover.value !== 'all') {
    queryParams.set('server', serversPopover.value);
  }

  fetch(`${endpoint}?${queryParams.toString()}`, {
    method: 'GET',
  })
    .then((response) => response.text())
    .then((data) => {
      const results = document.querySelector('#results');
      results.textContent = data;
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}

function initServersDropdown() {
  const serversPopover = initPopover(
    document.getElementById('servers-popover')
  );
  const { container } = serversPopover.components;
  let selectedServer = 'all';

  container.addEventListener('click', function (e) {
    if (e.target.tagName === 'LI') {
      const { value } = e.target.dataset;
      serversPopover.setButtonLabel(e.target.textContent);
      selectedServer = value;
      serversPopover.close();
    }
  });

  return {
    open() {
      serversPopover.open();
    },
    close() {
      serversPopover.close();
    },
    get value() {
      return selectedServer;
    },
  };
}

async function loadServers() {
  const response = await fetch('/servers');
  const { data } = await response.json();

  const servers = document.querySelector('#servers');
  servers.innerHTML = '';

  function addOption(server, label) {
    const option = document.createElement('li');
    option.dataset.value = server;
    option.textContent = label;

    servers.appendChild(option);
  }

  addOption('all', 'All Servers');
  data.forEach((server) => {
    addOption(server, server);
  });
}

function initUI() {
  initSearchForm();

  filePopover = initFilePopover();
  filePopover.open();

  serversPopover = initServersDropdown();
  loadServers();
}

document.addEventListener('DOMContentLoaded', initUI);

  // ---------- live clock ----------
  function tick(){
    const now = new Date();
    document.getElementById('clock').textContent =
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  tick();
  setInterval(tick, 1000);

  // ---------- shared state ----------
  const manifestList   = document.getElementById('manifest-list');
  const emptyState     = document.getElementById('empty-state');
  const visibleCountEl = document.getElementById('visible-count');
  const totalCountEl   = document.getElementById('total-count');
  const searchInput    = document.getElementById('manifest-search');
  const filterTabs     = document.querySelectorAll('.filter-tab');
  const courierNote    = document.getElementById('courier-filter-note');
  const courierNoteName= document.getElementById('courier-filter-name');
  const clearCourierBtn= document.getElementById('clear-courier-filter');

  let statusFilter  = 'all';
  let courierFilter = null;

  function bump(el){
    el.classList.remove('bump');
    void el.offsetWidth; // restart animation
    el.classList.add('bump');
  }

  function setStat(id, value){
    const el = document.getElementById(id);
    el.textContent = value;
    bump(el);
  }

  // ---------- filtering ----------
  function applyFilters(){
    const query = searchInput.value.trim().toLowerCase();
    let visible = 0;

    manifestList.querySelectorAll('.ticket').forEach(ticket => {
      const status  = ticket.dataset.status;
      const courier = ticket.dataset.courier || '';
      const text    = ticket.textContent.toLowerCase();

      const matchesStatus  = statusFilter === 'all' || status === statusFilter;
      const matchesCourier = !courierFilter || courier === courierFilter;
      const matchesSearch  = !query || text.includes(query);
      const show = matchesStatus && matchesCourier && matchesSearch;

      ticket.hidden = !show;
      if (show) visible++;
    });

    visibleCountEl.textContent = visible;
    emptyState.hidden = visible !== 0;
  }

  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      statusFilter = tab.dataset.filter;
      applyFilters();
    });
  });

  searchInput.addEventListener('input', applyFilters);

  // ---------- courier roster click-to-filter ----------
  document.getElementById('courier-roster').addEventListener('click', e => {
    const card = e.target.closest('.courier-card');
    if (!card) return;
    const name = card.dataset.courier;

    document.querySelectorAll('.courier-card').forEach(c => {
      c.classList.remove('is-selected');
      c.setAttribute('aria-pressed', 'false');
    });

    if (courierFilter === name) {
      courierFilter = null;
      courierNote.hidden = true;
    } else {
      courierFilter = name;
      card.classList.add('is-selected');
      card.setAttribute('aria-pressed', 'true');
      courierNoteName.textContent = name;
      courierNote.hidden = false;
    }
    applyFilters();
  });
  document.getElementById('courier-roster').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.courier-card')) {
      e.preventDefault();
      e.target.closest('.courier-card').click();
    }
  });
  clearCourierBtn.addEventListener('click', () => {
    courierFilter = null;
    courierNote.hidden = true;
    document.querySelectorAll('.courier-card').forEach(c => {
      c.classList.remove('is-selected');
      c.setAttribute('aria-pressed', 'false');
    });
    applyFilters();
  });

  // ---------- sorting ----------
  const sortSelect = document.getElementById('manifest-sort');
  sortSelect.addEventListener('change', () => {
    const mode = sortSelect.value;
    const tickets = Array.from(manifestList.querySelectorAll('.ticket'));
    if (mode === 'default') {
      // restore document order by ticket id, descending (newest dispatch first)
      tickets.sort((a, b) => Number(b.dataset.id || 0) - Number(a.dataset.id || 0));
    } else if (mode === 'eta') {
      tickets.sort((a, b) => Number(a.dataset.eta || 9999) - Number(b.dataset.eta || 9999));
    } else if (mode === 'weight-desc') {
      tickets.sort((a, b) => Number(b.dataset.weight || 0) - Number(a.dataset.weight || 0));
    } else if (mode === 'weight-asc') {
      tickets.sort((a, b) => Number(a.dataset.weight || 0) - Number(b.dataset.weight || 0));
    } else if (mode === 'id') {
      tickets.sort((a, b) => Number(a.dataset.id || 0) - Number(b.dataset.id || 0));
    }
    tickets.forEach(t => manifestList.appendChild(t));
  });

  // ---------- deleting a ticket (click once to arm, again to confirm) ----------
  function removeTicket(ticket){
    const status = ticket.dataset.status;
    ticket.classList.add('is-leaving');
    ticket.addEventListener('animationend', () => {
      ticket.remove();
      totalCountEl.textContent = Math.max(0, Number(totalCountEl.textContent) - 1);
      if (status === 'transit') setStat('stat-transit', Math.max(0, Number(document.getElementById('stat-transit').textContent) - 1));
      if (status === 'late')    setStat('stat-late', Math.max(0, Number(document.getElementById('stat-late').textContent) - 1));
      applyFilters();
    }, { once: true });
  }

  manifestList.addEventListener('click', e => {
    const delBtn = e.target.closest('.ticket-delete');
    if (!delBtn) return;
    if (!delBtn.classList.contains('confirming')) {
      delBtn.classList.add('confirming');
      delBtn.textContent = 'Confirm?';
      setTimeout(() => {
        delBtn.classList.remove('confirming');
        delBtn.textContent = 'Delete';
      }, 3000);
      return;
    }
    removeTicket(delBtn.closest('.ticket'));
  });

  // ---------- bulk clear delivered ----------
  document.getElementById('clear-delivered').addEventListener('click', () => {
    manifestList.querySelectorAll('.ticket[data-status="done"]').forEach(ticket => {
      ticket.classList.add('is-leaving');
      ticket.addEventListener('animationend', () => {
        ticket.remove();
        totalCountEl.textContent = Math.max(0, Number(totalCountEl.textContent) - 1);
        applyFilters();
      }, { once: true });
    });
  });

  // ---------- mark a ticket as delivered ----------
  manifestList.addEventListener('click', e => {
    const btn = e.target.closest('.ticket-action');
    if (!btn) return;
    const ticket = btn.closest('.ticket');
    const wasStatus = ticket.dataset.status;

    ticket.dataset.status = 'done';
    ticket.querySelector('.badge').className = 'badge badge--done';
    ticket.querySelector('.badge').textContent = 'Delivered';

    const bar = ticket.querySelector('.progress__bar');
    bar.style.setProperty('--p', '100%');
    bar.style.background = 'var(--stamp)';
    bar.classList.remove('is-moving');

    const oldStamp = ticket.querySelector('.stamp');
    if (oldStamp) oldStamp.remove();
    const doneStamp = document.createElement('span');
    doneStamp.className = 'stamp stamp--done';
    doneStamp.textContent = 'DONE';
    ticket.appendChild(doneStamp);

    btn.remove();

    // roll the stats
    setStat('stat-delivered', Number(document.getElementById('stat-delivered').textContent) + 1);
    if (wasStatus === 'transit') {
      setStat('stat-transit', Math.max(0, Number(document.getElementById('stat-transit').textContent) - 1));
    }
    if (wasStatus === 'late') {
      setStat('stat-late', Math.max(0, Number(document.getElementById('stat-late').textContent) - 1));
    }

    applyFilters();
  });

  // ---------- dispatch form: validate + create a real ticket ----------
  const form = document.getElementById('dispatch-form');
  const successMsg = document.getElementById('form-success');
  const successId = document.getElementById('success-id');

  function makeTicketId(){
    return 'SW-' + Math.floor(2300 + Math.random() * 400);
  }

  function priorityStamp(priority){
    if (priority === 'rush') return '<span class="stamp stamp--rush">RUSH</span>';
    if (priority === 'same-hour') return '<span class="stamp stamp--rush" style="color:var(--route); border-color:var(--route);">1HR</span>';
    return '';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      const firstInvalid = form.querySelector(':invalid');
      if (firstInvalid) firstInvalid.focus();
      successMsg.hidden = true;
      return;
    }
    form.classList.remove('was-validated');

    const data = Object.fromEntries(new FormData(form).entries());
    const id = makeTicketId();
    const idNum = id.replace('SW-', '');

    const ticket = document.createElement('article');
    ticket.className = 'ticket is-new';
    ticket.tabIndex = 0;
    ticket.dataset.status = 'pending';
    ticket.dataset.courier = 'Unassigned';
    ticket.dataset.eta = '9999';
    ticket.dataset.weight = data.weight;
    ticket.dataset.id = idNum;
    ticket.innerHTML = `
      <div class="ticket__perf"></div>
      <div class="ticket__body">
        <div class="flex items-center justify-between mb-2">
          <span class="font-mono text-xs text-chalkdim">${id}</span>
          <span class="badge badge--pending">Pending pickup</span>
        </div>
        <h3 class="font-display text-base mb-2">${data.pickup} → ${data.dropoff}</h3>
        <dl class="ticket__meta grid grid-cols-3 gap-2 text-xs mb-3">
          <div><dt class="text-chalkdim">Courier</dt><dd class="text-chalkdim">Unassigned</dd></div>
          <div><dt class="text-chalkdim">Weight</dt><dd>${data.weight} kg</dd></div>
          <div><dt class="text-chalkdim">Priority</dt><dd>${data.priority}</dd></div>
        </dl>
        <div class="progress"><div class="progress__bar" style="--p:0%"></div></div>
        <div class="ticket__actions">
          <button type="button" class="ticket-action">Mark delivered</button>
          <button type="button" class="ticket-delete" aria-label="Delete ticket ${id}">Delete</button>
        </div>
      </div>
      ${priorityStamp(data.priority)}
    `;
    manifestList.prepend(ticket);

    totalCountEl.textContent = Number(totalCountEl.tesxtContent) + 1;
    applyFilters();

    successId.textContent = id;
    successMsg.hidden = false;
    form.reset();
    setTimeout(() => { successMsg.hidden = true; }, 5000);
  });

  // initial paint
  applyFilters();
async function loadData() {
  const container = document.getElementById('data');

  try {
    const response = await fetch('https://jsonplaceholder.typicode.com/users');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const users = await response.json();

    container.innerHTML = users
      .map(user => `<p>${user.name} — ${user.email}</p>`)
      .join('');

  } catch (error) {
    console.error('Fetch error:', error);
    container.innerHTML = '<p>Failed to load data.</p>';
  }
}

loadData();
var find = document.getElementById('find');
var day1 = document.getElementById('day1');
var day2 = document.getElementById('day2');
var day3 = document.getElementById('day3');


// Days of the week and months
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

(function () {
  getData('cairo')
})();

find.addEventListener('input', function () {
  getData(find.value)
})

async function getData(city) {
  try {
    var response = await fetch(`https://api.weatherapi.com/v1/forecast.json?key=0d39cf0e8b25456bac2105848242611&q=${city}&days=7`);
    var data = await response.json();
    display(data);
    
    // Prepare weather data for 3 days
    const weather = [0, 1, 2].map(i => {
      const day = data.forecast.forecastday[i];
      return {
        date: day.date,
        temp_c: i === 0 ? data.current.temp_c : day.day.maxtemp_c,
        min_temp_c: day.day.mintemp_c,
        max_temp_c: day.day.maxtemp_c,
        wind_kph: i === 0 ? data.current.wind_kph : day.day.maxwind_kph,
        condition_text: i === 0 ? data.current.condition.text : day.day.condition.text,
        condition_icon: i === 0 ? data.current.condition.icon : day.day.condition.icon
      };
    });
    
    // Save to search history
    try {
      const historyResponse = await fetch('/api/weather/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ location: city, weather })
      });
      
      if (!historyResponse.ok) {
        console.error('Failed to save to history:', await historyResponse.text());
      }
    } catch (error) {
      console.error('Error saving to history:', error);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

function display(data) {
  const cardStyles = `
    background-color: #1E202B;
    border-radius: 10px;
    padding: 20px;
    margin: 10px;
    color: white;
  `;

  const headerStyles = `
    padding: 16px;
    background-color: #2D303D;
    color: rgb(191, 193, 200);
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  
  const infoStyles = `
    background-color: #323544;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: rgb(191, 193, 200);
  `;
  
  const tempStyles = `
    font-size: 4rem;
    font-weight: bold;
    color: white;
  `;

  // Display Today
  const todayDate = new Date(data.forecast.forecastday[0].date);
  const todayLabel = "Today"; // Label for today
  const todayFormattedDate = `${todayDate.getDate()} ${monthNames[todayDate.getMonth()]}`;

  day1.innerHTML = `
    <div style="${cardStyles}">
      <div class="header" style="${headerStyles}">
        <span>${todayLabel}</span>
        <span>${todayFormattedDate}</span>
      </div>
      <div class="info" style="${infoStyles}">
        <span style="font-size: 18px;">${data.location.name}</span>
        <div class="d-flex justify-content-around align-items-center">
          <h1 style="${tempStyles}">${data.current.temp_c}°C</h1>
          <img src="https:${data.current.condition.icon}" alt="Weather Icon" style="width: 60px;">
        </div>
        <span style="color: #009AD8;">${data.current.condition.text}</span>
        <div class="d-flex justify-content-start gap-4">
          <div class="d-flex align-items-center gap-2">
            <img src="img/icon-umberella.png" alt="Cloudiness" style="width: 20px;">
            <span>${data.current.cloud}%</span>
          </div>
          <div class="d-flex align-items-center gap-2">
            <img src="img/icon-wind.png" alt="Wind" style="width: 20px;">
            <span>${data.current.wind_kph} km/h</span>
          </div>
          <div class="d-flex align-items-center gap-2">
            <img src="img/icon-compass.png" alt="Direction" style="width: 20px;">
            <span>${data.current.wind_dir}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Display Tomorrow
  const tomorrowDate = new Date(data.forecast.forecastday[1].date);
  const tomorrowLabel = "Tomorrow"; // Label for tomorrow
  const tomorrowFormattedDate = `${tomorrowDate.getDate()} ${monthNames[tomorrowDate.getMonth()]}`;

  day2.innerHTML = `
    <div style="${cardStyles}">
      <div class="header" style="${headerStyles}">
        <span>${tomorrowLabel}</span>
        <span>${tomorrowFormattedDate}</span>
      </div>
      <div class="info" style="background-color: #262936; padding: 24px; text-align: center;">
        <img src="https:${data.forecast.forecastday[1].day.condition.icon}" alt="Weather Icon" style="width: 50px;">
        <h5 style="color: white; font-size: 1.5rem; margin: 8px 0;">${data.forecast.forecastday[1].day.maxtemp_c}°C</h5>
        <span style="font-size: 1rem;">${data.forecast.forecastday[1].day.mintemp_c}°C</span>
        <span style="color: #009AD8; display: block; margin-top: 8px;">${data.forecast.forecastday[1].day.condition.text}</span>
      </div>
    </div>
  `;

  // Display the 3rd day
  const thirdDate = new Date(data.forecast.forecastday[2].date);
  const thirdLabel = days[thirdDate.getDay()]; // Label for 3rd day
  const thirdFormattedDate = `${thirdDate.getDate()} ${monthNames[thirdDate.getMonth()]}`;

  day3.innerHTML = `
    <div style="${cardStyles}">
      <div class="header" style="${headerStyles}">
        <span>${thirdLabel}</span>
        <span>${thirdFormattedDate}</span>
      </div>
      <div class="info" style="background-color: #262936; padding: 24px; text-align: center;">
        <img src="https:${data.forecast.forecastday[2].day.condition.icon}" alt="Weather Icon" style="width: 50px;">
        <h5 style="color: white; font-size: 1.5rem; margin: 8px 0;">${data.forecast.forecastday[2].day.maxtemp_c}°C</h5>
        <span style="font-size: 1rem;">${data.forecast.forecastday[2].day.mintemp_c}°C</span>
        <span style="color: #009AD8; display: block; margin-top: 8px;">${data.forecast.forecastday[2].day.condition.text}</span>
      </div>
    </div>
  `;
}

import React, { useState } from 'react'
import { Container, Typography, Tabs, Tab, Box } from '@mui/material'
// import ContentGeneration from './components/contentgeneration/ContentGeneration'
import QoETrackerDemo from './components/qoe/QoETrackerDemo'
import AnalyticsPage from './pages/Analytics'

function App() {
  console.log('App component rendering')
  const [tabValue, setTabValue] = useState(0)

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue)
  }

  return (
    <>
      {/* Always show header and tabs */}
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          🎬 Quality of Experience (QOE) Tracking
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="main tabs"
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            {/* <Tab label="Video Processing" /> */}
            <Tab label="Viewer View" />
            <Tab label="Admin CMS" />
          </Tabs>
        </Box>

        {/* Content based on selected tab */}
        {/* {tabValue === 0 && <ContentGeneration />} */}
        {tabValue === 0 && <QoETrackerDemo />}

        {/* Full-screen QoE Tracker */}
        {tabValue === 1 && (
          <div style={{
            width: '100%',
            minHeight: '100vh',
            margin: 0,
            padding: 0,
            background: 'linear-gradient(to bottom right, #0f172a, #1e293b)',
          }}>
            <AnalyticsPage />
          </div>
        )}

        {/* Analytics Page */}
        {/* {tabValue === 2 && (
          <div style={{
            width: '100%',
            minHeight: '100vh',
            margin: 0,
            padding: 0,
          }}>
            <AnalyticsPage />
          </div>
        )} */}
      </Container>
    </>
  )
}

export default App
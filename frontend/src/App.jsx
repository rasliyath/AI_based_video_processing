import React from 'react'
import { Container, Typography } from '@mui/material'
import ContentGeneration from './components/contentgeneration/ContentGeneration'

function App() {
  console.log('App component rendering')
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        🎬 AI Video Processor
      </Typography>
      <ContentGeneration />
    </Container>
  )
}

export default App
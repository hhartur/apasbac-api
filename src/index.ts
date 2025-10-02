import env from './utils/env.ts'
import app from './app.ts'

function bootstrap(){
    const PORT = env.PORT || 3001
    app.listen(PORT, () => {
        console.log(`Servidor no ar: http://localhost:${PORT}`)
    })
}

bootstrap();
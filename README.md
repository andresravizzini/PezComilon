Pez Orco Mutante
Descripción general
Pez Orco Mutante es un minijuego arcade para navegador que se ejecuta íntegramente sobre un lienzo HTML5 con estética marina y estilos CSS ligeros. No requiere dependencias ni procesos de compilación: basta con servir index.html para cargar los estilos y el script principal del juego.

Características principales
Progresión por niveles con etapas diseñadas (incluido un jefe final) que determinan la cantidad de peces rivales, los parámetros del krill y los peligros presentes en el agua.

Mapa de selección con círculos numerados que muestran el estado de cada fase (bloqueado, disponible o ganado), resaltan el último intento y limitan el acceso hasta superar los niveles previos.

Batalla contra jefe con un tiburón que persigue al jugador y minas detonables cuya explosión puede dañarlo o dejarte fuera de combate.

Comportamiento de la fauna con animación de cola y lógica de huida o persecución según el tamaño relativo de cada pez controlado por la IA.

El pez protagonista abre una boca estilo Pac-Man al alimentarse, crece con cada presa y dispara un efecto sonoro “crunch” sintetizado en tiempo real.

Ecosistema vivo con krill que reaparece, medusas letales y burbujas ambientales que refuerzan la ambientación submarina.

Controles
Mouse: mueve el cursor o haz clic para definir el rumbo del pez cuando la partida está en curso; en la pantalla de selección puedes hacer clic sobre los círculos para saltar a un nivel.

Pantallas táctiles: arrastra el dedo para guiar al protagonista y toca los círculos del mapa para elegir fase.

Teclado: pulsa las teclas numéricas 1–3 para iniciar inmediatamente cualquier nivel desbloqueado, incluido el enfrentamiento contra el jefe final.

Audio
La banda sonora acuática se genera mediante osciladores y LFOs del Web Audio API para crear un fondo alegre y rítmico.

El mordisco mezcla ruido bandpass con osciladores adicionales para un “crunch” grave y contundente.

Debido a las políticas de los navegadores, el audio se habilita tras la primera interacción del jugador (clic, toque o tecla), que dispara handleUserAudioUnlock desde los controladores de entrada.

Ejecución local
Clona o descarga este repositorio en tu equipo.

Sirve la carpeta con tu servidor HTTP estático preferido (por ejemplo, npx http-server) o abre index.html directamente en el navegador si tu entorno lo permite.

Interactúa con la pantalla para desbloquear el audio y selecciona un nivel desde el mapa.

Estructura del proyecto
index.html: punto de entrada del juego; referencia la hoja de estilos y el script principal.

style.css: define la estética marina, el formato del lienzo y los overlays de mensajes.

script.js: contiene toda la lógica del juego, la gestión de niveles, IA de los peces, control del jugador, audio y renderizado.

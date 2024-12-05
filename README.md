# Label Sorter

created using React + Vite + Electron Forge

Desktop application for sorting labels to their correct corresponding machine

Instructions:
1. Navigate to "RR_Orders\src\Server\index.js"
    - You can either open terminal and CD to the file location, or go to the file, right click, and open in terminal
2. Start the server by typing "node index.js"
    - You will know if the server has started if you see "Server running on http://localhost:3000"
3. Open application and give it a moment to load
4. Upload .xlsx, .zip, and enter name of sheet to reference (CASE SENSITIVE)
    - App is not compatible with .xls so you will have to convert it to .xlsx if that's the case
5. Click submit. After processing, it will give you the option to save the sorted labels. The terminal will list out the number of labels that weren't found in the sheet as well as the names.
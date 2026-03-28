⏱️ OT Management System

📌 Project Description

The OT Management System is a full-stack web application developed to manage and monitor employee overtime in an organization. In many companies, overtime is still tracked manually using spreadsheets or paper records, which can lead to errors, lack of transparency, and difficulty in enforcing company policies. This project was designed to solve those problems by providing a centralized and automated system for handling overtime data.

The application allows users to record overtime details, apply validation rules, and generate reports in a structured and efficient way. It ensures that all overtime entries follow predefined business rules, making the system reliable and consistent.

🎯 Objective

The main objective of this project is to simplify the process of managing overtime by replacing manual methods with a digital solution. It focuses on improving accuracy, reducing human errors, and providing real-time access to overtime data for better decision-making. The system also ensures that company policies such as weekly and monthly overtime limits are strictly followed.

⚙️ How the System Works

The system begins with a secure login process where users enter their credentials. Once authenticated, a session is created and the user is allowed to access protected pages such as the dashboard, employee management, and overtime entry modules. The system stores user details like employee name and department in the session to personalize the experience.

After logging in, users can select their department and view employees associated with it. They can then enter overtime details such as date, shift, number of hours, reason, and the person who assigned the overtime. Before saving the data, the system performs multiple validations to ensure that the entry follows company rules.

For example, the system checks whether the overtime is being entered for the current month only. It also calculates the total overtime worked by the employee in the selected week and month. If the weekly limit of 12 hours or the monthly limit of 48 hours is exceeded, the system prevents the entry and displays an appropriate message.

Once validated, the overtime record is stored in the database with a “Pending” status. Only approved records are considered in reports and summaries, ensuring data accuracy.

🛠️ Technologies Used

This project is built using Node.js and Express.js for the backend, which handle routing, server logic, and API development. The frontend is developed using HTML, CSS, and JavaScript, providing a simple and user-friendly interface.

The application uses SQL Server as the database, and the connection is established using the mssql library with the msnodesqlv8 driver. Session management is implemented using express-session, which helps in maintaining user authentication across different pages.

Additionally, the system uses the ExcelJS library to generate and export overtime reports in Excel format, which is useful for analysis and record-keeping.

🗄️ Database Design

The database used in this project is named OTManagementDB. It consists of multiple tables such as Employees, Departments, OT_Records, and Login. Each employee is associated with a department, and overtime records are linked to employees.

This relational structure helps in organizing the data efficiently and makes it easier to fetch reports based on department, employee, or date range.

📊 Reporting and Export

One of the important features of this system is the reporting functionality. Users can filter overtime data based on department, employee, and date range. The system calculates the total overtime hours and displays detailed records in a structured format.

In addition to viewing the data on the screen, users can also export the report as an Excel file. This feature is especially useful for HR and management teams who need to analyze overtime data or maintain official records.

🔐 Business Rules

The system strictly enforces several business rules to ensure proper overtime management. It does not allow overtime entries for previous or future months, ensuring that all data is recorded in real time. It also restricts overtime to a maximum of 12 hours per week and 48 hours per month for each employee. These validations help maintain compliance with organizational policies.

💡 Key Highlights

This project demonstrates the implementation of real-world business logic using a full-stack approach. It includes RESTful API development, database integration, session-based authentication, and dynamic data handling. The project also focuses on modular coding practices, making it easy to maintain and extend in the future.

📈 Future Enhancements

In the future, this project can be enhanced by adding role-based access control for different users such as Admin, HR, and Employees. Additional features like email notifications for approvals, graphical dashboards for analytics, and mobile responsiveness can also be implemented to improve usability and functionality.

👩‍💻 Author

Gowthami Poojary
B.Tech in Computer Science and Engineering

⭐ Conclusion

The OT Management System is a practical and scalable solution for managing employee overtime. It not only simplifies the process but also ensures accuracy, transparency, and compliance with company policies. This project reflects strong understanding of backend development, database design, and real-world application development.

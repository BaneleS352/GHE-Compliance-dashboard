using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace GHEBackend.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Declarations",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Employee = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    TeamMemberNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    LineManager = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Position = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Department = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Company = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Team = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Counterparty = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Value = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Submitted = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Approver = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Priority = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Relationship = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    ReceivedGiven = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    From = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ContactPerson = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    BiddingProcess = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ContractNegotiation = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Occasion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Date = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Instances = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    PublicOfficial = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Substantiation = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Declarations", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "Declarations",
                columns: new[] { "Id", "Approver", "BiddingProcess", "Company", "ContactPerson", "ContractNegotiation", "Counterparty", "Date", "Department", "Description", "Employee", "From", "Instances", "LineManager", "Occasion", "Position", "Priority", "PublicOfficial", "ReceivedGiven", "Relationship", "Status", "Submitted", "Substantiation", "Team", "TeamMemberNumber", "Type", "Value" },
                values: new object[,]
                {
                    { "GHE-2024-0040", "Sipho Nkosi", "No", "Hollywoodbets Group", "Lebo Mahlangu", null, "Radisson Blu", "2024-10-25", "Marketing", "Team dinner for campaign launch celebration", "Siphamandla Ndlovu", "Team Member", "1", "Lindiwe Zulu", "Milestone", "Brand Strategist", "Low", "No", "Given", "Internal – Team Event", "Draft", "2024-10-28", null, "Brand & Communications", "HB-244001", "Hospitality", 5600m },
                    { "GHE-2024-0041", "Lindiwe Zulu", "N/A", "Hollywoodbets Group", "Priya Naidoo", null, "Edgars", "2024-10-28", "Legal", "Clothing voucher received at legal conference", "Fatima Ismail", "Customer", "1", "Sipho Nkosi", "Other", "Legal Counsel", "Medium", "No", "Received", "External – Industry Event", "Info Requested", "2024-10-30", null, "Legal & Compliance", "HB-167823", "Gift", 890m },
                    { "GHE-2024-0042", "Sipho Nkosi", "Yes", "Hollywoodbets Group", "Riaan Botha", null, "Sun International", "2024-10-31", "IT", "Golf day and networking event hosted by Sun International", "Bongani Cele", "Supplier", "2", "Lindiwe Zulu", "Relationship Maintenance", "IT Systems Lead", "Medium", "No", "Received", "Counterparty – IT Solutions", "Pending", "2024-11-02", null, "Technology", "HB-234512", "Entertainment", 12800m },
                    { "GHE-2024-0043", "Lindiwe Zulu", "No", "Hollywoodbets Group", "Thandi Molefe", null, "Woolworths", "2024-11-02", "HR", "Festive season hamper from staffing agency", "Zanele Sithole", "Supplier", "1", "Sipho Nkosi", "Festive", "HR Generalist", "Low", "No", "Received", "Supplier – Staffing", "Approved", "2024-11-04", null, "People & Culture", "HB-198741", "Gift", 650m },
                    { "GHE-2024-0044", "Sipho Nkosi", "No", "Hollywoodbets Group", "Mark Johnson", null, "La Colombe Restaurant", "2024-11-04", "Finance", "Lunch meeting with audit consultants", "Pieter van der Berg", "Customer", "1", "Lindiwe Zulu", "Relationship Maintenance", "Finance Analyst", "Medium", "No", "Given", "Service Provider – Annual", "Declined", "2024-11-06", null, "Financial Reporting", "HB-156902", "Hospitality", 3200m },
                    { "GHE-2024-0045", "Lindiwe Zulu", "Yes", "Hollywoodbets Group", "Ahmed Al-Rashid", null, "Emirates Airline", "2024-11-05", "Operations", "Business class flights and lounge access for conference", "Ayanda Khumalo", "Customer", "3", "Sipho Nkosi", "Other", "Operations Manager", "High", "No", "Received", "Counterparty – Technology", "Escalated", "2024-11-08", null, "Operations", "HB-219033", "Entertainment", 34000m },
                    { "GHE-2024-0046", "Sipho Nkosi", "No", "Hollywoodbets Group", "Jane Dube", null, "Makro", "2024-11-08", "Sales", "End-of-year gift basket received from supplier", "Thabo Mokoena", "Supplier", "1", "Lindiwe Zulu", "Festive", "Sales Executive", "Low", "No", "Received", "Supplier – Regular", "Approved", "2024-11-10", null, "Enterprise Sales", "HB-187234", "Gift", 1200m },
                    { "GHE-2024-0047", "Sipho Nkosi", "No", "Hollywoodbets Group", "John Smith", null, "Tsogo Sun Hotels", "2024-11-10", "Marketing", "Corporate dinner for key partners at Sandton Sun", "Nomvula Dlamini", "Supplier", "2", "Sipho Nkosi", "Relationship Maintenance", "Senior Brand Manager", "High", "No", "Received", "Client – Strategic Partner", "Pending", "2024-11-12", null, "Brand & Communications", "HB-204478", "Hospitality", 8500m }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Declarations");
        }
    }
}

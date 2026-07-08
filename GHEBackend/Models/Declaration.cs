using System.ComponentModel.DataAnnotations;

namespace GHEBackend.Models;

public class Declaration
{
    [Key]
    [MaxLength(30)]
    public string Id { get; set; } = string.Empty;

    [MaxLength(150)]
    public string Employee { get; set; } = string.Empty;

    [MaxLength(30)]
    public string TeamMemberNumber { get; set; } = string.Empty;

    [MaxLength(100)]
    public string LineManager { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Position { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Department { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Company { get; set; }

    [MaxLength(100)]
    public string? Team { get; set; }

    [MaxLength(50)]
    public string Type { get; set; } = string.Empty;

    [MaxLength(150)]
    public string Counterparty { get; set; } = string.Empty;

    public decimal Value { get; set; }

    [MaxLength(20)]
    public string Submitted { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Approver { get; set; } = string.Empty;

    /// <summary>Draft | Pending | Approved | Declined | Escalated | Info Requested</summary>
    [MaxLength(30)]
    public string Status { get; set; } = string.Empty;

    /// <summary>High | Medium | Low</summary>
    [MaxLength(10)]
    public string Priority { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(150)]
    public string Relationship { get; set; } = string.Empty;

    /// <summary>Received | Given</summary>
    [MaxLength(20)]
    public string ReceivedGiven { get; set; } = string.Empty;

    /// <summary>Supplier | Customer | Team Member etc.</summary>
    [MaxLength(100)]
    public string From { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ContactPerson { get; set; } = string.Empty;

    [MaxLength(20)]
    public string BiddingProcess { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? ContractNegotiation { get; set; }

    [MaxLength(100)]
    public string Occasion { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Date { get; set; } = string.Empty;

    [MaxLength(10)]
    public string Instances { get; set; } = string.Empty;

    [MaxLength(10)]
    public string PublicOfficial { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Substantiation { get; set; }
}

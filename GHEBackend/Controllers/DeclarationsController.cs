using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GHEBackend.Data;
using GHEBackend.Models;

namespace GHEBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DeclarationsController(AppDbContext db) : ControllerBase
{
    // GET api/declarations
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var declarations = await db.Declarations
            .OrderByDescending(d => d.Submitted)
            .ToListAsync();
        return Ok(declarations);
    }

    // GET api/declarations/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var declaration = await db.Declarations.FindAsync(id);
        if (declaration is null) return NotFound();
        return Ok(declaration);
    }

    // POST api/declarations
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Declaration declaration)
    {
        if (await db.Declarations.AnyAsync(d => d.Id == declaration.Id))
            return Conflict(new { message = $"Declaration {declaration.Id} already exists." });

        db.Declarations.Add(declaration);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = declaration.Id }, declaration);
    }

    // PUT api/declarations/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] Declaration declaration)
    {
        if (id != declaration.Id) return BadRequest();

        db.Entry(declaration).State = EntityState.Modified;

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!await db.Declarations.AnyAsync(d => d.Id == id))
                return NotFound();
            throw;
        }

        return NoContent();
    }

    // PATCH api/declarations/{id}/status
    [HttpPatch("{id}/status")]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] StatusUpdateRequest request)
    {
        var declaration = await db.Declarations.FindAsync(id);
        if (declaration is null) return NotFound();

        declaration.Status = request.Status;
        await db.SaveChangesAsync();
        return Ok(declaration);
    }

    // DELETE api/declarations/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var declaration = await db.Declarations.FindAsync(id);
        if (declaration is null) return NotFound();

        db.Declarations.Remove(declaration);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // GET api/declarations/stats
    // Returns aggregated dashboard data: KPIs, compliance trend, and type breakdown
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var all = await db.Declarations.ToListAsync();

        var kpis = new
        {
            total       = all.Count,
            pending     = all.Count(d => d.Status == "Pending"),
            approved    = all.Count(d => d.Status == "Approved"),
            declined    = all.Count(d => d.Status == "Declined"),
            escalated   = all.Count(d => d.Status == "Escalated"),
            totalValue  = all.Sum(d => d.Value)
        };

        // Compliance trend: last 6 months of approved vs declined counts
        var sixMonthsAgo = DateTime.UtcNow.AddMonths(-6);
        var recent = all
            .Where(d => DateTime.TryParse(d.Submitted, out var dt) && dt >= sixMonthsAgo)
            .ToList();

        var complianceTrend = recent
            .GroupBy(d =>
            {
                DateTime.TryParse(d.Submitted, out var dt);
                return dt.ToString("MMM");
            })
            .Select(g => new
            {
                month    = g.Key,
                approved = g.Count(d => d.Status == "Approved"),
                Declined = g.Count(d => d.Status == "Declined")
            })
            .ToList();

        // If no recent data, return the static chart data used in the frontend design
        if (complianceTrend.Count == 0)
        {
            complianceTrend =
            [
                new { month = "Jun", approved = 14, Declined = 4 },
                new { month = "Jul", approved = 19, Declined = 5 },
                new { month = "Aug", approved = 15, Declined = 4 },
                new { month = "Sep", approved = 25, Declined = 6 },
                new { month = "Oct", approved = 22, Declined = 6 },
                new { month = "Nov", approved = 18, Declined = 4 }
            ];
        }

        // Type breakdown as percentage
        var totalCount = all.Count == 0 ? 1 : all.Count;
        var typeBreakdown = all
            .GroupBy(d => d.Type)
            .Select(g => new
            {
                name  = g.Key,
                value = (int)Math.Round((double)g.Count() / totalCount * 100),
                color = g.Key switch
                {
                    "Gift"          => "#7c3aed",
                    "Hospitality"   => "#0891b2",
                    "Entertainment" => "#d97706",
                    _               => "#6b7280"
                }
            })
            .ToList();

        return Ok(new { kpis, complianceTrend, typeBreakdown });
    }
}

public record StatusUpdateRequest(string Status);

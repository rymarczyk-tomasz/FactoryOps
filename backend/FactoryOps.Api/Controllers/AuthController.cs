using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FactoryOps.Api.Database.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(
	UserManager<ApplicationUser> userManager,
	IConfiguration configuration) : ControllerBase
{
	private readonly UserManager<ApplicationUser> userManager = userManager;
	private readonly IConfiguration configuration = configuration;

	[HttpPost("register")]
	public async Task<IActionResult> Register(RegisterRequest request)
	{
		var user = new ApplicationUser { UserName = request.Email, Email = request.Email };
		var result = await this.userManager.CreateAsync(user, request.Password);
		if (!result.Succeeded)
		{
			return BadRequest(result.Errors.Select(e => e.Description));
		}
		return Ok();
	}

	[HttpPost("login")]
	public async Task<IActionResult> Login(LoginRequest request)
	{
		var user = await this.userManager.FindByEmailAsync(request.Email);
		if (user == null) return Unauthorized();

		var valid = await this.userManager.CheckPasswordAsync(user, request.Password);
		if (!valid) return Unauthorized();

		var token = GenerateJwtToken(user);
		return Ok(new { token });
	}

	private string GenerateJwtToken(ApplicationUser user)
	{
		var jwtSection = this.configuration.GetSection("Jwt");
		var key = jwtSection.GetValue<string>("Key") ?? "replace_this_with_a_strong_key";
		var issuer = jwtSection.GetValue<string>("Issuer") ?? "FactoryOps";
		var audience = jwtSection.GetValue<string>("Audience") ?? "FactoryOpsClients";
		var expiryMinutes = jwtSection.GetValue<int?>("ExpiryMinutes") ?? 60;

		var claims = new List<Claim>
		{
			new(JwtRegisteredClaimNames.Sub, user.Id),
			new(JwtRegisteredClaimNames.Email, user.Email ?? ""),
			new(ClaimTypes.Name, user.UserName ?? "")
		};

		var keyBytes = Encoding.UTF8.GetBytes(key);
		var creds = new SigningCredentials(new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256);

		var token = new JwtSecurityToken(
			issuer: issuer,
			audience: audience,
			claims: claims,
			expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
			signingCredentials: creds
		);

		return new JwtSecurityTokenHandler().WriteToken(token);
	}

}

public record RegisterRequest(string Email, string Password);
public record LoginRequest(string Email, string Password);
